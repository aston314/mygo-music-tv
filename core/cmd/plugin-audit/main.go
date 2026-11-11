// plugin-audit installs official public plugins in an isolated directory and
// checks read-only guest APIs. It never signs in, likes, posts or edits data.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"

	product "mygo-music-tv"
	"mygo-music-tv/core/internal/catalog"
	"mygo-music-tv/core/internal/compatibility"
	"mygo-music-tv/core/internal/music"
	"mygo-music-tv/core/internal/plugin"
	"mygo-music-tv/core/internal/sources"
)

func stage(err error, count int) compatibility.Stage {
	if err == nil {
		return compatibility.Stage{State: "passed", Count: count}
	}
	code := "request-failed"
	for _, v := range []struct {
		e error
		c string
	}{{music.ErrSignIn, "sign-in-required"}, {music.ErrSetup, "setup-required"}, {music.ErrUnsupported, "unsupported"}, {music.ErrUnavailable, "unavailable"}} {
		if errors.Is(err, v.e) {
			code = v.c
		}
	}
	return compatibility.Stage{State: "blocked", Code: code}
}
func inspect(m *sources.Manager, e catalog.Entry, root string) compatibility.Entry {
	r := compatibility.Entry{Repository: e.Repository, Stages: map[string]compatibility.Stage{"login": {State: "not-tested", Code: "requires-user-authorization"}, "devicePlayback": {State: "not-tested", Code: "requires-device"}}}
	id := sources.Key(e.Repository)
	p, err := m.Get(id)
	if err != nil {
		job, x := m.Start(e.Repository)
		if x != nil {
			r.Stages["install"] = stage(x, 0)
			return r
		}
		deadline := time.Now().Add(4 * time.Minute)
		for time.Now().Before(deadline) {
			j, _ := m.Job(job.ID)
			if j.State == "failed" {
				r.Stages["install"] = compatibility.Stage{State: "blocked", Code: installFailure(j.Message)}
				return r
			}
			if j.State == "complete" {
				break
			}
			time.Sleep(200 * time.Millisecond)
		}
		p, err = m.Get(id)
		if err != nil {
			r.Stages["install"] = compatibility.Stage{State: "blocked", Code: "install-timeout"}
			return r
		}
	}
	defer p.Close()
	info := p.Info()
	r.Name = info.Name
	r.Version = info.Version
	r.Playback = string(info.Playback)
	r.Process = p.Permissions().Process
	if o := p.Origin(); o != nil {
		r.Revision = o.Version
	}
	for _, method := range sources.Methods {
		if p.Can(method) {
			r.Capabilities = append(r.Capabilities, method)
		}
	}
	r.Stages["install"] = compatibility.Stage{State: "passed"}
	// Classify host calls from installed runnable source, not README claims.
	found := map[string]bool{}
	filepath.WalkDir(filepath.Join(root, "instances", id, "plugins"), func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if d.IsDir() {
			switch d.Name() {
			case "test", "tests", "scripts", "node_modules", ".git":
				return filepath.SkipDir
			}
			return nil
		}
		if strings.Contains(d.Name(), ".test.") {
			return nil
		}
		if !(strings.HasSuffix(path, ".js") || strings.HasSuffix(path, ".ts")) {
			return nil
		}
		b, _ := os.ReadFile(path)
		s := string(b)
		for _, v := range []struct{ call, kind string }{{"webSignIn", "cookies"}, {"waitForRedirect", "oauth"}, {"signInPrompt", "prompt"}} {
			if strings.Contains(s, "host."+v.call) {
				found[v.kind] = true
			}
		}
		return nil
	})
	for kind := range found {
		r.Login = append(r.Login, kind)
	}
	sort.Strings(r.Login)
	if !p.Can("signIn") {
		r.Stages["login"] = compatibility.Stage{State: "not-provided"}
	}
	for _, method := range []string{"account", "home", "playlists"} {
		if p.Can(method) {
			_, x := p.CallExport(method, nil)
			r.Stages[method] = stage(x, 0)
		}
	}
	var tracks []music.Track
	if p.Can("search") {
		v, x := p.Search("周杰伦", "tracks", 0)
		if v != nil {
			tracks = v.Tracks
		}
		r.Stages["search"] = stage(x, len(tracks))
	}
	if len(tracks) > 0 {
		t := tracks[0]
		if p.Can("lyrics") {
			_, x := p.Lyrics(t.ID)
			r.Stages["lyrics"] = stage(x, 0)
		}
		if p.Can("comments") {
			v, x := p.Comments(t.ID, 0)
			n := 0
			if v != nil {
				n = len(v.Comments)
			}
			r.Stages["comments"] = stage(x, n)
		}
		if p.Can("stream") && info.Playback != music.PlaybackRemote {
			v, x := p.Stream(t.ID, "high")
			s := stage(x, 0)
			if x == nil && (v == nil || !strings.HasPrefix(v.URL, "http://") && !strings.HasPrefix(v.URL, "https://")) {
				s = compatibility.Stage{State: "blocked", Code: "non-http-media"}
			}
			r.Stages["streamResolve"] = s
		}
	}
	return r
}
func installFailure(message string) string {
	m := strings.ToLower(message)
	for _, v := range []struct{ part, code string }{{"rate limit", "github-rate-limit"}, {"403", "http-denied"}, {"404", "not-found"}, {"newer", "newer-runtime-required"}, {"needs mygo", "newer-runtime-required"}, {"plugin.json", "invalid-package"}, {"compile", "compile-failed"}, {"syntax", "compile-failed"}, {"deadline", "network-timeout"}, {"timeout", "network-timeout"}} {
		if strings.Contains(m, v.part) {
			return v.code
		}
	}
	return "download-or-build-failed"
}
func main() {
	root := flag.String("data-dir", "build/plugin-compat-audit", "isolated audit data; never use an account data directory")
	out := flag.String("output", "core/internal/compatibility/report.json", "report output")
	workers := flag.Int("workers", 3, "concurrent read-only audits")
	retry := flag.Bool("retry-blocked", false, "reuse successful entries and retry failed installation checks")
	flag.Parse()
	log.SetOutput(io.Discard)
	// Refuse existing account directories: an audit must start as a guest.
	marker := filepath.Join(*root, ".audit-only")
	if _, e := os.Stat(marker); e != nil {
		dirs, _ := os.ReadDir(filepath.Join(*root, "instances"))
		if len(dirs) > 0 {
			panic("refusing unmarked data directory; choose a new audit directory")
		}
		if e = os.MkdirAll(*root, 0700); e != nil {
			panic(e)
		}
		if e = os.WriteFile(marker, []byte("guest-plugin-audit\n"), 0600); e != nil {
			panic(e)
		}
	}
	plugin.SetAppVersion(product.App().PluginCompatibilityVersion)
	plugin.PublicRepositoriesOnly()
	m, err := sources.New(filepath.Join(*root, "instances"))
	if err != nil {
		panic(err)
	}
	defer m.Close()
	c := catalog.New(product.App().PluginCatalogURL, filepath.Join(*root, "catalog.json"))
	snap, err := c.Get(context.Background(), true)
	if err != nil {
		panic(err)
	}
	report := compatibility.Report{ObservedAt: time.Now().UTC().Format(time.RFC3339), Directory: c.URL, Host: runtime.GOOS + "/" + runtime.GOARCH + "; portable HTTP runtime; no account; no audio playback"}
	kept := map[string]bool{}
	if *retry {
		var old compatibility.Report
		if b, e := os.ReadFile(*out); e == nil && json.Unmarshal(b, &old) == nil {
			for _, e := range old.Entries {
				if e.Stages["install"].State == "passed" {
					report.Entries = append(report.Entries, e)
					kept[strings.ToLower(e.Repository)] = true
				}
			}
		}
	}
	var mu sync.Mutex
	save := func() {
		sort.Slice(report.Entries, func(i, j int) bool { return report.Entries[i].Repository < report.Entries[j].Repository })
		b, _ := json.MarshalIndent(report, "", "  ")
		_ = os.MkdirAll(filepath.Dir(*out), 0700)
		_ = os.WriteFile(*out+".part", append(b, '\n'), 0600)
		_ = os.Rename(*out+".part", *out)
	}
	jobs := make(chan catalog.Entry)
	var wg sync.WaitGroup
	for i := 0; i < max(1, min(*workers, 4)); i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for e := range jobs {
				r := inspect(m, e, *root)
				mu.Lock()
				report.Entries = append(report.Entries, r)
				save()
				fmt.Printf("%d/%d %s install=%s search=%s stream=%s\n", len(report.Entries), len(snap.Entries), r.Repository, r.Stages["install"].State+":"+r.Stages["install"].Code, r.Stages["search"].State, r.Stages["streamResolve"].State)
				mu.Unlock()
			}
		}()
	}
	for _, e := range snap.Entries {
		if !kept[strings.ToLower(e.Repository)] {
			jobs <- e
		}
	}
	close(jobs)
	wg.Wait()
}
