package server

import (
	"mygo-music-tv/core/internal/plugin"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestArtworkSurvivesLongPlaybackWhileAudioStillExpires(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/png")
		_, _ = w.Write([]byte("cover"))
	}))
	defer upstream.Close()
	m := newMedia()
	defer m.close()
	cover := m.addImage(upstream.URL, nil)
	audio := m.add(upstream.URL, nil, time.Minute, false)
	m.leases[strings.TrimPrefix(cover, "/media/")].Expires = time.Now().Add(-time.Hour)
	m.leases[strings.TrimPrefix(audio, "/media/")].Expires = time.Now().Add(-time.Hour)
	// Browsing another page used to sweep away the playing cover after 30m.
	m.addImage(upstream.URL+"/next", nil)
	w := httptest.NewRecorder()
	m.ServeHTTP(w, httptest.NewRequest("GET", cover, nil))
	if w.Code != 200 || w.Body.String() != "cover" {
		t.Fatalf("playing cover expired: %d", w.Code)
	}
	w = httptest.NewRecorder()
	m.ServeHTTP(w, httptest.NewRequest("GET", audio, nil))
	if w.Code != 410 {
		t.Fatal("audio expiry was relaxed")
	}
	m.revoke(cover)
	w = httptest.NewRecorder()
	m.ServeHTTP(w, httptest.NewRequest("GET", cover, nil))
	if w.Code != 410 {
		t.Fatal("revoked artwork remained usable")
	}
}

func TestArtworkLRUIsBoundedAndPreservesCurrentCoverAndAudio(t *testing.T) {
	m := newMedia()
	defer m.close()
	audio := m.add("https://example.com/audio", nil, time.Hour, false)
	cover := m.addImage("https://example.com/current", nil)
	m.protectArtwork(cover)
	var recent string
	for i := 0; i < 1600; i++ {
		recent = m.addImage("https://example.com/browse", nil)
	}
	if len(m.leases) > 1500 || !m.has(cover) || !m.has(audio) || !m.has(recent) {
		t.Fatal("image LRU dropped active media or exceeded its bound")
	}
	m.protectArtwork("")
	m.leases[strings.TrimPrefix(cover, "/media/")].Used = time.Time{}
	m.addImage("https://example.com/another", nil)
	if m.has(cover) {
		t.Fatal("former cover stayed pinned")
	}
}

func TestNextQueueEntryRevivesEvictedArtwork(t *testing.T) {
	s := newTest(t)
	q := fixtureQueue()
	q[0].Album.ImageURL = s.media.addImage("https://example.com/first", nil)
	q[1].Album.ImageURL = s.media.addImage("https://example.com/second", nil)
	if err := s.player.play(q, 0); err != nil {
		t.Fatal(err)
	}
	old := q[1].Album.ImageURL
	s.media.revoke(old)
	if err := s.player.advance(1, false, 0); err != nil {
		t.Fatal(err)
	}
	after := s.player.snapshot()
	cover := after.Queue[after.Index].Album.ImageURL
	if cover == old || !s.media.has(cover) {
		t.Fatal("next track kept a dead artwork lease")
	}
}

func TestArtworkReadsCurrentImageCredentials(t *testing.T) {
	var got string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = r.Header.Get("X-Image-Token")
		_, _ = w.Write([]byte("cover"))
	}))
	defer upstream.Close()
	dir := t.TempDir()
	manifest := `{"id":"images","permissions":{"network":["127.0.0.1"]},"requestHeaders":[{"hosts":["127.0.0.1"],"kinds":["image"],"headers":{"X-Image-Token":"{setting:token}"}}]}`
	if err := os.WriteFile(filepath.Join(dir, "plugin.json"), []byte(manifest), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "index.js"), []byte(`export function home(){return {sections:[]};}`), 0600); err != nil {
		t.Fatal(err)
	}
	src, err := plugin.Load(dir, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer src.Close()
	m := newMedia()
	defer m.close()
	cover := m.addImage(upstream.URL, src)
	for _, token := range []string{"first", "refreshed"} {
		if err := src.SetSetting("token", token); err != nil {
			t.Fatal(err)
		}
		w := httptest.NewRecorder()
		m.ServeHTTP(w, httptest.NewRequest("GET", cover, nil))
		if w.Code != 200 || got != token {
			t.Fatal("cover reused old image credentials")
		}
	}
}
