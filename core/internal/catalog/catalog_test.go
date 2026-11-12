package catalog

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestFirstLaunchUsesCompleteBundledDirectoryWhileOffline(t *testing.T) {
	c := New("https://music.egoist.dev/zh/plugins", filepath.Join(t.TempDir(), "catalog.json"))
	called, allow, done := make(chan struct{}), make(chan struct{}), make(chan struct{})
	c.Client = &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		close(called)
		<-allow
		defer close(done)
		return &http.Response{StatusCode: 503, Body: io.NopCloser(strings.NewReader("offline")), Header: http.Header{}}, nil
	})}
	first, err := c.Get(context.Background(), false)
	if err != nil || len(first.Entries) != 62 || !first.Stale || first.Message == "" {
		t.Fatalf("first launch lost bundled directory: %+v %v", first, err)
	}
	<-called
	close(allow)
	<-done
	again, err := c.Get(context.Background(), false)
	if err != nil || len(again.Entries) != 62 || !again.Stale || !again.UpdatedAt.Equal(first.UpdatedAt) {
		t.Fatal("failed refresh replaced usable directory", err)
	}
	if custom := New("https://example.com/plugins", filepath.Join(t.TempDir(), "catalog.json")); len(custom.saved.Entries) != 0 {
		t.Fatal("bundled directory was used for an unrelated URL")
	}
}

// Discovery follows actual install links rather than CSS classes and refuses empty updates.
func TestDirectoryAndStaleCache(t *testing.T) {
	html := `<article><h2>Music</h2><p>通过 <a href="https://github.com/Author/Music">GitHub</a> 提供在线音乐</p><div><a href="mygo-music://install-plugin?repo=Author/Music"><span>安装</span></a><a href="https://github.com/Author/Music"><span>GitHub</span></a></div></article><a href="mygo-music://install-plugin?repo=author/music">duplicate</a><a href="mygo-music://install-plugin?repo=../escape">bad</a>`
	entries, e := Parse(strings.NewReader(html))
	if e != nil || len(entries) != 1 || entries[0].Repository != "Author/Music" {
		t.Fatalf("%+v %v", entries, e)
	}
	if entries[0].Name != "Music" || entries[0].Description != "通过 GitHub 提供在线音乐" {
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

func TestDirectoryCardSeparatesTitleRepositoryStarsAndProse(t *testing.T) {
	markup := `<article class="plugin-card"><div class="plugin-card-head"><div class="plugin-title"><h2>网易云音乐</h2><a class="plugin-repo" href="https://github.com/author/mygo-music-netease">author/mygo-music-netease</a></div><span class="plugin-stars">103</span></div><p class="platform-note">支持 GitHub API 与 24 小时播放</p><div class="plugin-actions"><a href="mygo-music://install-plugin?repo=author/mygo-music-netease">安装</a><a href="https://github.com/author/mygo-music-netease">GitHub</a></div></article>`
	entries, err := Parse(strings.NewReader(markup))
	if err != nil || len(entries) != 1 || entries[0].Name != "网易云音乐" || entries[0].Description != "支持 GitHub API 与 24 小时播放" {
		t.Fatalf("card metadata mixed into prose: %+v %v", entries, err)
	}
	for _, input := range []struct{ text, want string }{
		{"netease author/mygo-music-netease 103 支持 GitHub API 与 24 小时播放 安装 GitHub", "支持 GitHub API 与 24 小时播放"},
		{"支持 GitHub API 与 24 小时播放", "支持 GitHub API 与 24 小时播放"},
		{"提到 author/mygo-music-netease 103 的介绍", "提到 author/mygo-music-netease 103 的介绍"},
	} {
		entry := Entry{Name: "mygo-music-netease", Repository: "author/mygo-music-netease", Description: input.text}
		cleanEntry(&entry)
		if entry.Description != input.want {
			t.Fatalf("cache migration: %q != %q", entry.Description, input.want)
		}
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

func TestPublicMirrorSnapshotRequiresFreshCompleteEntries(t *testing.T) {
	valid := Snapshot{Entries: []Entry{{Repository: "Author/Music", Name: "Music", Description: "在线音乐"}}, UpdatedAt: time.Now().UTC()}
	b, err := json.Marshal(struct {
		Schema    int       `json:"schema"`
		Source    string    `json:"source"`
		UpdatedAt time.Time `json:"updatedAt"`
		Entries   []Entry   `json:"entries"`
	}{1, "https://music.egoist.dev/zh/plugins", valid.UpdatedAt, valid.Entries})
	if err != nil {
		t.Fatal(err)
	}
	parsed, err := ParseMirror(b, "https://music.egoist.dev/zh/plugins")
	if err != nil || len(parsed.Entries) != 1 || parsed.Source != "public-mirror" {
		t.Fatalf("valid mirror rejected: %+v %v", parsed, err)
	}
	for _, mutate := range []func(*map[string]any){
		func(v *map[string]any) { (*v)["schema"] = 2 },
		func(v *map[string]any) { (*v)["source"] = "https://example.com" },
		func(v *map[string]any) { (*v)["entries"] = []Entry{} },
	} {
		var value map[string]any
		if err := json.Unmarshal(b, &value); err != nil {
			t.Fatal(err)
		}
		mutate(&value)
		bad, err := json.Marshal(value)
		if err != nil {
			t.Fatal(err)
		}
		if _, err = ParseMirror(bad, "https://music.egoist.dev/zh/plugins"); err == nil {
			t.Fatal("invalid public mirror accepted")
		}
	}
}

func TestCachedDirectoryReturnsDuringOneSharedRefresh(t *testing.T) {
	started, release := make(chan struct{}), make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		close(started)
		<-release
		_, _ = io.WriteString(w, `<article><h2>New</h2><a href="mygo-music://install-plugin?repo=Author/New">安装</a></article>`)
	}))
	defer srv.Close()
	c := New(srv.URL, filepath.Join(t.TempDir(), "catalog.json"))
	c.saved = Snapshot{Entries: []Entry{{Repository: "Author/Old", Name: "Old"}}, UpdatedAt: time.Now().Add(-time.Hour)}
	first, err := c.Get(context.Background(), false)
	if err != nil || !first.Refreshing || first.Entries[0].Name != "Old" {
		t.Fatal(first, err)
	}
	<-started
	// This must not wait for the in-flight network request or start another one.
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()
	result := make(chan Snapshot, 1)
	go func() { s, _ := c.Get(ctx, false); result <- s }()
	select {
	case cached := <-result:
		if !cached.Refreshing || cached.Entries[0].Name != "Old" {
			t.Fatal(cached)
		}
	case <-ctx.Done():
		close(release)
		t.Fatal("cache waited for network")
	}
	c.mu.Lock()
	done := c.flight
	c.mu.Unlock()
	close(release)
	<-done
	updated, err := c.Get(context.Background(), false)
	if err != nil || updated.Refreshing || updated.Entries[0].Name != "New" {
		t.Fatal(updated, err)
	}
	restored := New(srv.URL, c.Path)
	if restored.saved.Entries[0].Name != "New" {
		t.Fatal("fresh directory was not persisted")
	}
}

func TestSlowOfficialDirectoryFallsBackWithoutLosingMirrorTimestamp(t *testing.T) {
	original := http.DefaultTransport
	defer func() { http.DefaultTransport = original }()
	now := time.Now().UTC().Add(-time.Minute)
	payload, _ := json.Marshal(map[string]any{"schema": 1, "source": "https://official.test/plugins", "updatedAt": now, "entries": []Entry{{Repository: "Author/Music", Name: "在线音乐"}}})
	var hosts []string
	http.DefaultTransport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		hosts = append(hosts, r.URL.Host)
		if r.Header.Get("Authorization") != "" {
			t.Fatal("unexpected credential")
		}
		body := string(payload)
		if r.URL.Host == "gh-proxy.com" {
			body = "<html>challenge</html>"
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body)), Header: http.Header{}}, nil
	})
	c := NewWithMirror("https://official.test/plugins", "https://raw.githubusercontent.com/owner/repo/main/catalog.json", filepath.Join(t.TempDir(), "catalog.json"))
	c.Client = &http.Client{Timeout: 20 * time.Millisecond, Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) { <-r.Context().Done(); return nil, r.Context().Err() })}
	got, err := c.Get(context.Background(), true)
	if err != nil || got.Source != "public-mirror" || !got.UpdatedAt.Equal(now) || got.Entries[0].Name != "在线音乐" {
		t.Fatal(got, err)
	}
	if strings.Join(hosts, ",") != "gh-proxy.com,v4.gh-proxy.org" {
		t.Fatal(hosts)
	}
	// Even a valid proxy response cannot roll newer local data back.
	c.mu.Lock()
	c.saved.UpdatedAt = now.Add(time.Second)
	c.mu.Unlock()
	again, err := c.Get(context.Background(), true)
	if err != nil || !again.Stale || !again.UpdatedAt.Equal(now.Add(time.Second)) {
		t.Fatal("newer cache replaced", again, err)
	}
}
