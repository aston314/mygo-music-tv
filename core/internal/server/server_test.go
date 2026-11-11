package server

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"

	"mygo-music-tv/core/internal/music"
)

func newTest(t *testing.T) *Server {
	t.Helper()
	s, e := New(t.TempDir(), "fixture", "test-local-token-01234567890123456789")
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(s.Close)
	return s
}

// Requests from another site cannot control the local server, even with a session cookie.
func TestLocalAuthorization(t *testing.T) {
	s := newTest(t)
	for _, test := range []struct {
		token, origin string
		status        int
	}{{"", "", 401}, {s.token, "http://evil.invalid", 403}, {s.token, "", 200}} {
		r := httptest.NewRequest("GET", "http://127.0.0.1/health", nil)
		r.Header.Set("Authorization", "Bearer "+test.token)
		r.Header.Set("Origin", test.origin)
		w := httptest.NewRecorder()
		s.ServeHTTP(w, r)
		if w.Code != test.status {
			t.Fatalf("%d != %d", w.Code, test.status)
		}
	}
}

// Late ended/failed events from the previous track cannot affect a new generation.
func TestRapidTrackSwitch(t *testing.T) {
	s := newTest(t)
	queue := []music.Track{{ID: "t1", Source: "fixture", Name: "one"}, {ID: "t2", Source: "fixture", Name: "two"}}
	if e := s.player.play(queue, 0); e != nil {
		t.Fatal(e)
	}
	old := s.player.snapshot().Generation
	if e := s.player.play(queue, 1); e != nil {
		t.Fatal(e)
	}
	if s.player.event(old, "ended", 0, 0) || s.player.event(old, "failed", 0, 0) {
		t.Fatal("accepted stale player event")
	}
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		p := s.player.snapshot()
		if p.State == "ready" {
			if p.Index != 1 || p.Media == "" {
				t.Fatalf("%+v", p)
			}
			return
		}
		time.Sleep(time.Millisecond)
	}
	t.Fatal("second resolve never became ready")
}

func TestPluginUpdateGuardPreservesPlayback(t *testing.T) {
	s := newTest(t)
	s.player.Lock()
	s.player.state = Playback{State: "playing", Queue: []music.Track{{ID: "song", Source: "online"}}, Index: 0, Generation: 42, Media: "/media/existing", Position: 1500, WantPlay: true}
	s.player.Unlock()
	before := s.player.snapshot()
	release, err := s.player.guardPluginUpdate("online")
	if err != nil {
		t.Fatal(err)
	}
	release()
	if !reflect.DeepEqual(before, s.player.snapshot()) {
		t.Fatal("activation guard changed playback")
	}
	for _, state := range []Playback{
		{State: "preparing", Queue: before.Queue},
		{State: "playing", Queue: before.Queue, Remote: true},
		{State: "paused", Queue: before.Queue, Remote: true},
	} {
		s.player.Lock()
		s.player.state = state
		s.player.Unlock()
		if release, err = s.player.guardPluginUpdate("online"); err == nil {
			release()
			t.Fatal("allowed replacement during source-dependent playback")
		}
		release, err = s.player.guardPluginUpdate("another-source")
		if err != nil {
			t.Fatal(err)
		}
		release()
	}
}

// Range streaming preserves seek support and strips all source credentials on cross-host redirects.
func TestMediaRangeAndRedirect(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "" || r.Header.Get("Cookie") != "" || r.Header.Get("X-Token") != "" {
			t.Error("credentials leaked")
		}
		if r.Header.Get("Range") != "bytes=1-3" {
			t.Error("range lost")
		}
		w.Header().Set("Content-Range", "bytes 1-3/5")
		w.WriteHeader(206)
		_, _ = w.Write([]byte("bcd"))
	}))
	defer target.Close()
	redirect := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, strings.Replace(target.URL, "127.0.0.1", "localhost", 1), 302)
	}))
	defer redirect.Close()
	m := newMedia()
	defer m.close()
	path := m.add(redirect.URL, map[string]string{"Authorization": "secret", "Cookie": "secret", "X-Token": "secret"}, time.Minute, false)
	r := httptest.NewRequest("GET", path, nil)
	r.Header.Set("Range", "bytes=1-3")
	w := httptest.NewRecorder()
	m.ServeHTTP(w, r)
	if w.Code != 206 || w.Body.String() != "bcd" {
		t.Fatalf("%d %s", w.Code, w.Body.String())
	}
	m.revoke(path)
	w = httptest.NewRecorder()
	m.ServeHTTP(w, r)
	if w.Code != 410 {
		t.Fatal("revoked media still served")
	}
}

// The HTTP source adapter returns instance identity and never exposes raw streaming URLs.
func TestSourceContract(t *testing.T) {
	s := newTest(t)
	r := httptest.NewRequest("POST", "/api/sources/fixture/call/search", bytes.NewBufferString(`{"query":"song","kind":"tracks","offset":0}`))
	r.Header.Set("Authorization", "Bearer "+s.token)
	w := httptest.NewRecorder()
	s.ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	var data music.SearchResult
	if e := json.Unmarshal(w.Body.Bytes(), &data); e != nil || len(data.Tracks) != 3 || data.Tracks[0].Source != "fixture" {
		t.Fatalf("%+v %v", data, e)
	}
	r = httptest.NewRequest("POST", "/api/sources/fixture/call/stream", bytes.NewBufferString(`{"id":"t1"}`))
	r.Header.Set("Authorization", "Bearer "+s.token)
	w = httptest.NewRecorder()
	s.ServeHTTP(w, r)
	if w.Code != 400 {
		t.Fatal("raw stream route exposed")
	}
}
