package phoneinput

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

func broker(t *testing.T) *Broker {
	t.Helper()
	b := New()
	b.address = func() (string, error) { return "127.0.0.1", nil }
	t.Cleanup(b.Close)
	return b
}
func start(t *testing.T, b *Broker, target string) View {
	t.Helper()
	v, e := b.Start(Request{Target: target, Context: "来源 · 歌曲", Initial: "原关键词", Language: "zh-TW", Theme: "dark"})
	if e != nil {
		t.Fatal(e)
	}
	return v
}
func phone(t *testing.T, b *Broker, s *session, method, path, body, token string) *httptest.ResponseRecorder {
	t.Helper()
	base := strings.Split(s.url, "/input#")[0]
	r := httptest.NewRequest(method, base+path, strings.NewReader(body))
	r.RemoteAddr = "192.168.1.8:12345"
	r.Header.Set("Authorization", "Bearer "+token)
	r.Header.Set("Origin", base)
	w := httptest.NewRecorder()
	b.servePhone(s, w, r)
	return w
}
func TestScopedInputAndPrivateApplicationBoundary(t *testing.T) {
	b := broker(t)
	v := start(t, b, "resource")
	s := b.active
	if v.ExpiresAt-v.ServerNow != Lifetime.Milliseconds() || len(v.ID) != 48 || !strings.Contains(v.URL, "/input#") || strings.Contains(v.URL, v.ID) {
		t.Fatalf("bad capability metadata: %+v", v)
	}
	for _, path := range []string{"/input", "/phone.js", "/phone.css", "/i18n.js", "/locales/zh-CN.js", "/locales/zh-TW.js"} {
		w := phone(t, b, s, "GET", path, "", "")
		if w.Code != 200 || w.Header().Get("Cache-Control") != "no-store" {
			t.Fatalf("asset %s: %d", path, w.Code)
		}
	}
	for _, path := range []string{"/api/player", "/api/sources", "/api/login", "/api/input-session", "/app.js", "/media/private"} {
		if w := phone(t, b, s, "GET", path, "", s.token); w.Code != 404 {
			t.Fatalf("LAN exposed %s: %d", path, w.Code)
		}
	}
	if w := phone(t, b, s, "GET", "/input/session", "", v.ID); w.Code != 401 {
		t.Fatal("owner ID authorized phone")
	}
	w := phone(t, b, s, "GET", "/input/session", "", s.token)
	if w.Code != 200 || strings.Contains(w.Body.String(), s.id) || strings.Contains(w.Body.String(), s.token) || strings.Contains(w.Body.String(), `"url"`) {
		t.Fatal("phone leaked owner capability")
	}
	if w := phone(t, b, s, "POST", "/input/session", `{"target":"plugins","value":"跨字段"}`, s.token); w.Code != 400 {
		t.Fatal("accepted wrong field")
	}
	if w := phone(t, b, s, "POST", "/input/session", `{"target":"resource","value":"  中文 <音乐> 🎵  "}`, s.token); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	result, ok := b.Status(v.ID)
	if !ok || result.State != "submitted" || result.Value != "中文 <音乐> 🎵" {
		t.Fatalf("lost submitted value: %+v", result)
	}
	if w := phone(t, b, s, "POST", "/input/session", `{"target":"resource","value":"重复"}`, s.token); w.Code != 409 {
		t.Fatal("accepted duplicate")
	}
	b.Cancel(v.ID, 0)
	if _, ok := b.Status(v.ID); ok {
		t.Fatal("cancelled owner exists")
	}
	if w := phone(t, b, s, "POST", "/input/session", `{"target":"resource","value":"迟到"}`, s.token); w.Code != 410 {
		t.Fatal("accepted cancelled submission")
	}
}
func TestInvalidInputAndCrossSiteRequests(t *testing.T) {
	b := broker(t)
	start(t, b, "plugins")
	s := b.active
	for _, body := range []string{`{`, `{"target":"plugins","value":""}`, `{"target":"plugins","value":"   "}`, `{"target":"plugins","value":"a\nb"}`, `{"target":"plugins","value":"ok","admin":true}`, `{"target":"plugins","value":"ok"}{}`, `{"target":"plugins","value":"` + strings.Repeat("歌", 201) + `"}`, `{"target":"plugins","value":"` + string([]byte{0xff}) + `"}`, strings.Repeat(" ", 4096)} {
		w := phone(t, b, s, "POST", "/input/session", body, s.token)
		if w.Code != 400 {
			t.Fatalf("invalid body accepted: %d", w.Code)
		}
	}
	base := strings.Split(s.url, "/input#")[0]
	for _, tc := range []struct{ host, origin, remote string }{{"evil.invalid:80", base, "192.168.1.8:123"}, {strings.TrimPrefix(base, "http://"), "http://evil.invalid", "192.168.1.8:123"}, {strings.TrimPrefix(base, "http://"), base, "8.8.8.8:123"}} {
		r := httptest.NewRequest("POST", base+"/input/session", strings.NewReader(`{"target":"plugins","value":"x"}`))
		r.Host = tc.host
		r.RemoteAddr = tc.remote
		r.Header.Set("Origin", tc.origin)
		r.Header.Set("Authorization", "Bearer "+s.token)
		w := httptest.NewRecorder()
		b.servePhone(s, w, r)
		if w.Code != 403 {
			t.Fatal("accepted cross-site or public request")
		}
	}
	if w := phone(t, b, s, "GET", "/input/session", "", s.token); !strings.Contains(w.Body.String(), `"state":"connected"`) {
		t.Fatal("invalid inputs consumed session")
	}
}
func TestExpiryRefreshAndDelayedNativeCancel(t *testing.T) {
	b := broker(t)
	clock := time.Now()
	b.now = func() time.Time { return clock }
	v := start(t, b, "resource")
	old := b.active
	b.mu.Lock()
	clock = clock.Add(time.Second)
	b.mu.Unlock()
	next := start(t, b, "plugins")
	fresh := b.active
	b.Cancel(v.ID, 0)
	b.Cancel("", v.ServerNow)
	if got, ok := b.Status(next.ID); !ok || got.State != "waiting" {
		t.Fatal("old cancellation affected new session")
	}
	if w := phone(t, b, old, "POST", "/input/session", `{"target":"resource","value":"late"}`, old.token); w.Code != 410 {
		t.Fatal("refresh left old session usable")
	}
	b.mu.Lock()
	clock = clock.Add(31 * time.Second)
	b.mu.Unlock()
	if got, ok := b.Status(next.ID); !ok || got.State != "expired" {
		t.Fatal("owner lease did not expire")
	}
	if w := phone(t, b, fresh, "GET", "/input/session", "", fresh.token); w.Code != 410 {
		t.Fatal("phone extended owner lease")
	}
	v = start(t, b, "resource")
	b.mu.Lock()
	clock = clock.Add(Lifetime)
	b.mu.Unlock()
	if got, _ := b.Status(v.ID); got.State != "expired" {
		t.Fatal("lifetime extended")
	}
}
func TestConcurrentSubmissionOnlyAcceptsOne(t *testing.T) {
	b := broker(t)
	v := start(t, b, "resource")
	s := b.active
	var wg sync.WaitGroup
	codes := make(chan int, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			w := phone(t, b, s, "POST", "/input/session", `{"target":"resource","value":"一次"}`, s.token)
			codes <- w.Code
		}()
	}
	wg.Wait()
	close(codes)
	accepted := 0
	for code := range codes {
		if code == 200 {
			accepted++
		} else if code != 409 {
			t.Fatalf("unexpected code %d", code)
		}
	}
	if accepted != 1 {
		t.Fatal(accepted)
	}
	if v, _ := b.Status(v.ID); v.Value != "一次" {
		t.Fatal("value lost")
	}
}
func TestRealListenerServesOnlyPhoneSurfaceAndCloses(t *testing.T) {
	b := broker(t)
	v := start(t, b, "plugins")
	base := strings.Split(v.URL, "#")[0]
	client := &http.Client{Timeout: time.Second, Transport: &http.Transport{Proxy: nil}}
	response, e := client.Get(base)
	if e != nil {
		t.Fatal(e)
	}
	body, _ := io.ReadAll(response.Body)
	response.Body.Close()
	if response.StatusCode != 200 || !strings.Contains(string(body), "My Music+") {
		t.Fatal("phone not served")
	}
	req, _ := http.NewRequest("GET", strings.Replace(base, "/input", "/input/session", 1), nil)
	req.Header.Set("Authorization", "Bearer "+strings.Split(v.URL, "#")[1])
	response, e = client.Do(req)
	if e != nil {
		t.Fatal(e)
	}
	var d View
	_ = json.NewDecoder(response.Body).Decode(&d)
	response.Body.Close()
	if d.State != "connected" {
		t.Fatal(d.State)
	}
	b.Close()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		response, e = client.Get(base)
		if e != nil {
			return
		}
		response.Body.Close()
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatal("listener remained open")
}
