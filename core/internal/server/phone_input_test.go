package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"mygo-music-tv/core/internal/phoneinput"
)

func inputRequest(s *Server, method, path, body string, authorized bool) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, "http://127.0.0.1"+path, strings.NewReader(body))
	if authorized {
		r.Header.Set("Authorization", "Bearer "+s.token)
	}
	w := httptest.NewRecorder()
	s.ServeHTTP(w, r)
	return w
}
func TestPhoneSessionOwnerAPIRequiresAppAuthorization(t *testing.T) {
	s := newTest(t)
	for _, method := range []string{"GET", "POST", "DELETE"} {
		if w := inputRequest(s, method, "/api/input-session", `{"target":"resource"}`, false); w.Code != 401 {
			t.Fatalf("%s: %d", method, w.Code)
		}
	}
	if w := inputRequest(s, "POST", "/api/input-session", `{"target":"login"}`, true); w.Code != 422 {
		t.Fatal("accepted wrong target")
	}
	w := inputRequest(s, "POST", "/api/input-session", `{"target":"resource","address":"192.168.42.1","context":"歌曲"}`, true)
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	var v phoneinput.View
	if err := json.Unmarshal(w.Body.Bytes(), &v); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(v.URL, s.token) || strings.Contains(v.URL, v.ID) {
		t.Fatal("LAN URL leaked core authorization")
	}
	if w = inputRequest(s, "GET", "/api/input-session/qr?id="+v.ID, "", true); w.Code != 200 || w.Header().Get("Content-Type") != "image/png" {
		t.Fatal("missing QR")
	}
	if w = inputRequest(s, "GET", "/api/input-session?id="+v.ID, "", false); w.Code != 401 {
		t.Fatal("owner status available without authorization")
	}
	if w = inputRequest(s, "DELETE", "/api/input-session", "", true); w.Code != 400 {
		t.Fatal("unscoped cancellation accepted")
	}
	if w = inputRequest(s, "DELETE", "/api/input-session?id="+v.ID, "", true); w.Code != 200 {
		t.Fatal("cancel failed")
	}
	if w = inputRequest(s, "GET", "/api/input-session?id="+v.ID, "", true); w.Code != 410 {
		t.Fatal("cancel left status available")
	}
	if w = inputRequest(s, "GET", "/api/input-session/qr?id="+v.ID, "", true); w.Code != http.StatusNotFound {
		t.Fatal("cancel left QR available")
	}
}
