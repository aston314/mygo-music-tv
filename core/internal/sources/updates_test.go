package sources

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"mygo-music-tv/core/internal/plugin"
)

func updateFixture(t *testing.T, version, permissions string) string {
	t.Helper()
	dir := t.TempDir()
	if e := os.WriteFile(filepath.Join(dir, "plugin.json"), []byte(fmt.Sprintf(`{"id":"music","name":"Music","version":%q,"permissions":%s}`, version, permissions)), 0600); e != nil {
		t.Fatal(e)
	}
	if e := os.WriteFile(filepath.Join(dir, "index.js"), []byte(`export function home(){return {title:host.setting("account")};}`), 0600); e != nil {
		t.Fatal(e)
	}
	return dir
}

func updateManager(t *testing.T) (*Manager, string) {
	t.Helper()
	m, e := New(t.TempDir())
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(m.Close)
	old := updateFixture(t, "1.0.0", `{"network":["api.example.com"]}`)
	m.fetch = func(ctx context.Context, repo, dir string) (*plugin.Pending, error) {
		p, e := plugin.Open(old, dir)
		if e == nil {
			p.Repo = repo
			p.Version = "v1.0.0"
		}
		return p, e
	}
	repo := "owner/music"
	if e = m.installRepo(Job{Repository: repo, InstanceID: Key(repo)}); e != nil {
		t.Fatal(e)
	}
	return m, Key(repo)
}

func eventually(t *testing.T, check func() bool) {
	t.Helper()
	deadline := time.Now().Add(4 * time.Second)
	for time.Now().Before(deadline) {
		if check() {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatal("timed out waiting for update")
}
func checked(t *testing.T, m *Manager, id string) {
	t.Helper()
	if e := m.CheckUpdates(id, true); e != nil {
		t.Fatal(e)
	}
	eventually(t, func() bool { return m.Updates()[0].State != "checking" })
}
func jobState(t *testing.T, m *Manager, id, state string) Job {
	t.Helper()
	var j Job
	eventually(t, func() bool { j, _ = m.Job(id); return j.State == state })
	return j
}

func TestUpdateChecksCacheFailureAndRestart(t *testing.T) {
	m, id := updateManager(t)
	var checks, downloads atomic.Int32
	m.latest = func(context.Context, string) (*plugin.Release, error) {
		checks.Add(1)
		return &plugin.Release{Repo: "owner/music", Version: "v1.0.0", URL: "https://github.com/owner/music/archive/v1.zip"}, nil
	}
	m.fetchRelease = func(context.Context, *plugin.Release, string) (*plugin.Pending, error) {
		downloads.Add(1)
		return nil, errors.New("must not download")
	}
	checked(t, m, id)
	if u := m.Updates()[0]; u.Available || u.State != "current" {
		t.Fatal(u)
	}
	_ = m.CheckUpdates("", false)
	if checks.Load() != 1 || downloads.Load() != 0 {
		t.Fatal("unchanged version downloaded or cache ignored")
	}
	m.latest = func(context.Context, string) (*plugin.Release, error) {
		checks.Add(1)
		return &plugin.Release{Repo: "owner/music", Version: "v2.0.0", URL: "https://github.com/owner/music/archive/v2.zip"}, nil
	}
	checked(t, m, id)
	m.latest = func(context.Context, string) (*plugin.Release, error) { return nil, errors.New("offline") }
	checked(t, m, id)
	u := m.Updates()[0]
	if !u.Available || u.LatestVersion != "v2.0.0" || u.State != "checkFailed" {
		t.Fatal(u)
	}
	m.Close()
	reloaded, e := New(m.root)
	if e != nil {
		t.Fatal(e)
	}
	defer reloaded.Close()
	u = reloaded.Updates()[0]
	if !u.Available || u.LatestVersion != "v2.0.0" {
		t.Fatal("update cache lost", u)
	}
	if downloads.Load() != 0 {
		t.Fatal("checking downloaded an archive")
	}
}

func TestUpdatePinsReleaseAndKeepsAccount(t *testing.T) {
	m, id := updateManager(t)
	p, _ := m.Get(id)
	_ = p.SetSetting("account", "listener")
	m.latest = func(context.Context, string) (*plugin.Release, error) {
		return &plugin.Release{Repo: "owner/music", Version: "v2.0.0", URL: "https://github.com/owner/music/archive/v2.zip"}, nil
	}
	checked(t, m, id)
	newCode := updateFixture(t, "2.0.0", `{"network":["api.example.com"]}`)
	m.fetchRelease = func(ctx context.Context, r *plugin.Release, dir string) (*plugin.Pending, error) {
		if r.Version != "v2.0.0" {
			return nil, errors.New("wrong target")
		}
		p, e := plugin.Open(newCode, dir)
		if e == nil {
			p.Release = *r
		}
		return p, e
	}
	if _, e := m.StartUpdate(id, "v3.0.0"); e == nil {
		t.Fatal("accepted an unshown version")
	}
	j, e := m.StartUpdate(id, "v2.0.0")
	if e != nil {
		t.Fatal(e)
	}
	jobState(t, m, j.ID, "complete")
	newPlugin, _ := m.Get(id)
	if newPlugin.Setting("account") != "listener" {
		t.Fatal("account lost")
	}
	if _, e = p.Home(); e == nil {
		t.Fatal("replaced VM restarted")
	}
	if u := m.Updates()[0]; u.Revision != "v2.0.0" || u.Available {
		t.Fatal(u)
	}
	if _, e = m.StartUpdate(id, "v2.0.0"); e == nil {
		t.Fatal("redownloaded installed version")
	}
}

func TestUpdatePermissionsConfirmCancelAndFailedActivation(t *testing.T) {
	m, id := updateManager(t)
	old, _ := m.Get(id)
	_ = old.SetSetting("account", "retained")
	m.latest = func(context.Context, string) (*plugin.Release, error) {
		return &plugin.Release{Repo: "owner/music", Version: "v2.0.0", URL: "https://github.com/owner/music/archive/v2.zip"}, nil
	}
	checked(t, m, id)
	code := updateFixture(t, "2.0.0", `{"network":["api.example.com","new.example.com"],"process":["helper"]}`)
	m.fetchRelease = func(ctx context.Context, r *plugin.Release, dir string) (*plugin.Pending, error) {
		p, e := plugin.Open(code, dir)
		if e == nil {
			p.Release = *r
		}
		return p, e
	}
	j, e := m.StartUpdate(id, "v2.0.0")
	if e != nil {
		t.Fatal(e)
	}
	waiting := jobState(t, m, j.ID, "awaiting-confirmation")
	if len(waiting.Permissions.Network) != 1 || waiting.Permissions.Network[0] != "new.example.com" || len(waiting.Permissions.Process) != 1 {
		t.Fatal(waiting)
	}
	if _, e = old.Home(); e != nil {
		t.Fatal("old plugin retired before approval", e)
	}
	if _, e = m.ConfirmUpdate(j.ID, false); e != nil {
		t.Fatal(e)
	}
	if _, e = m.ConfirmUpdate(j.ID, true); e == nil {
		t.Fatal("cancelled approval reused")
	}
	j, e = m.StartUpdate(id, "v2.0.0")
	if e != nil {
		t.Fatal(e)
	}
	jobState(t, m, j.ID, "awaiting-confirmation")
	// Make writing metadata fail after code replacement. The old code must roll back.
	meta := filepath.Join(m.root, id, "instance.json")
	_ = os.Remove(meta)
	_ = os.Mkdir(meta, 0700)
	if _, e = m.ConfirmUpdate(j.ID, true); e != nil {
		t.Fatal(e)
	}
	jobState(t, m, j.ID, "failed")
	p, _ := m.Get(id)
	if p != old || p.Info().Version != "1.0.0" || p.Setting("account") != "retained" {
		t.Fatal("failed update replaced old state")
	}
	manifest, e := os.ReadFile(filepath.Join(m.root, id, "plugins", "music", "plugin.json"))
	if e != nil || !strings.Contains(string(manifest), `"1.0.0"`) {
		t.Fatal("old code not restored", e)
	}
}

func TestLateChecksAndCloseCancellation(t *testing.T) {
	m, id := updateManager(t)
	started := make(chan struct{})
	release := make(chan struct{})
	m.latest = func(ctx context.Context, _ string) (*plugin.Release, error) {
		close(started)
		select {
		case <-release:
			return &plugin.Release{Repo: "owner/music", Version: "v9", URL: "https://github.com/owner/music/archive/v9.zip"}, nil
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
	_ = m.CheckUpdates(id, true)
	<-started
	if e := m.Remove(id); e != nil {
		t.Fatal(e)
	}
	close(release)
	m.wg.Wait()
	if len(m.Updates()) != 0 {
		t.Fatal("late result resurrected removed plugin")
	}
	m2, id2 := updateManager(t)
	began := make(chan struct{})
	m2.latest = func(ctx context.Context, _ string) (*plugin.Release, error) {
		close(began)
		<-ctx.Done()
		return nil, ctx.Err()
	}
	_ = m2.CheckUpdates(id2, true)
	<-began
	done := make(chan struct{})
	go func() { m2.Close(); close(done) }()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("shutdown did not cancel version check")
	}
}
