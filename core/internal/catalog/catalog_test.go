package catalog

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
)

// Discovery follows actual install links rather than CSS classes and refuses empty updates.
func TestDirectoryAndStaleCache(t *testing.T) {
	html := `<article><h2>Music</h2><a href="mygo-music://install-plugin?repo=Author/Music">Install</a></article><a href="mygo-music://install-plugin?repo=author/music">duplicate</a><a href="mygo-music://install-plugin?repo=../escape">bad</a>`
	entries, e := Parse(strings.NewReader(html))
	if e != nil || len(entries) != 1 || entries[0].Repository != "Author/Music" {
		t.Fatalf("%+v %v", entries, e)
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { _, _ = w.Write([]byte(html)) }))
	defer srv.Close()
	path := filepath.Join(t.TempDir(), "catalog.json")
	c := New(srv.URL, path)
	first, e := c.Get(context.Background(), true)
	if e != nil {
		t.Fatal(e)
	}
	html = "<main>new site without install links</main>"
	second, e := c.Get(context.Background(), true)
	if e != nil || !second.Stale || len(second.Entries) != 1 || !first.UpdatedAt.Equal(second.UpdatedAt) {
		t.Fatalf("lost usable cache: %+v %v", second, e)
	}
	restored := New(srv.URL, path)
	if len(restored.saved.Entries) != 1 {
		t.Fatal("cache not persisted")
	}
}
