package catalog

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Discovery follows actual install links rather than CSS classes and refuses empty updates.
func TestDirectoryAndStaleCache(t *testing.T) {
	html := `<article><h2>Music</h2><p>通过 <a href="https://github.com/Author/Music">GitHub</a> 提供在线音乐</p><div><a href="mygo-music://install-plugin?repo=Author/Music"><span>安装</span></a><a href="https://github.com/Author/Music"><span>GitHub</span></a></div></article><a href="mygo-music://install-plugin?repo=author/music">duplicate</a><a href="mygo-music://install-plugin?repo=../escape">bad</a>`
	entries, e := Parse(strings.NewReader(html))
	if e != nil || len(entries) != 1 || entries[0].Repository != "Author/Music" {
		t.Fatalf("%+v %v", entries, e)
	}
	if entries[0].Description != "Music 通过 GitHub 提供在线音乐" {
		t.Fatalf("directory controls mixed into description: %q", entries[0].Description)
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

func TestLegacyCachedDescriptionsLoseOnlyTrailingDirectoryActions(t *testing.T) {
	path := filepath.Join(t.TempDir(), "catalog.json")
	snapshot := Snapshot{Entries: []Entry{
		{Repository: "Author/Music", Description: "支持 GitHub API 的在线音乐 安装 GitHub"},
		{Repository: "Author/Other", Description: "支持 GitHub API 的在线音乐"},
	}}
	b, err := json.Marshal(snapshot)
	if err != nil {
		t.Fatal(err)
	}
	if err = os.WriteFile(path, b, 0600); err != nil {
		t.Fatal(err)
	}
	c := New("https://example.com/plugins", path)
	for _, entry := range c.saved.Entries {
		if entry.Description != "支持 GitHub API 的在线音乐" {
			t.Fatalf("unexpected cached description: %q", entry.Description)
		}
	}
}
