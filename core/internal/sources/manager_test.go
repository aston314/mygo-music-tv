package sources

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"mygo-music-tv/core/internal/plugin"
)

// Repositories with the same manifest ID keep separate settings across update, restart and removal.
func TestRepositoryIsolation(t *testing.T) {
	root := t.TempDir()
	fixture := t.TempDir()
	_ = os.WriteFile(filepath.Join(fixture, "plugin.json"), []byte(`{"id":"same","name":"Same"}`), 0600)
	_ = os.WriteFile(filepath.Join(fixture, "index.js"), []byte(`export function home(){ return {title:host.setting("account")}; }`), 0600)
	makeManager := func() *Manager {
		m, e := New(root)
		if e != nil {
			t.Fatal(e)
		}
		m.fetch = func(ctx context.Context, repo, dir string) (*plugin.Pending, error) {
			p, e := plugin.Open(fixture, dir)
			if e == nil {
				p.Repo = repo
				p.Version = "v1"
			}
			return p, e
		}
		return m
	}
	m := makeManager()
	for _, repo := range []string{"alice/music", "bob/music"} {
		if e := m.installRepo(Job{Repository: repo, InstanceID: Key(repo)}); e != nil {
			t.Fatal(e)
		}
	}
	a, _ := m.Get(Key("alice/music"))
	b, _ := m.Get(Key("bob/music"))
	_ = a.SetSetting("account", "Alice")
	_ = b.SetSetting("account", "Bob")
	if e := m.installRepo(Job{Repository: "alice/music", InstanceID: Key("alice/music")}); e != nil {
		t.Fatal(e)
	}
	if _, e := a.Home(); e == nil {
		t.Fatal("replaced instance restarted")
	}
	m.Close()
	m = makeManager()
	defer m.Close()
	a, _ = m.Get(Key("alice/music"))
	b, _ = m.Get(Key("bob/music"))
	ah, e := a.Home()
	if e != nil || ah.Title != "Alice" {
		t.Fatalf("Alice data lost: %+v %v", ah, e)
	}
	bh, e := b.Home()
	if e != nil || bh.Title != "Bob" {
		t.Fatalf("Bob data lost: %+v %v", bh, e)
	}
	if e = m.Remove(Key("alice/music")); e != nil {
		t.Fatal(e)
	}
	if _, e = a.Home(); e == nil {
		t.Fatal("removed instance restarted")
	}
	if b.Setting("account") != "Bob" {
		t.Fatal("other account was affected")
	}
	if e = m.installRepo(Job{Repository: "alice/music", InstanceID: Key("alice/music")}); e != nil {
		t.Fatal(e)
	}
	a, _ = m.Get(Key("alice/music"))
	if a.Setting("account") != "Alice" {
		t.Fatal("reinstall did not restore retained account data")
	}
}

// Optional album/duration fields do not erase instance ownership in a track page.
func TestStampOptionalTrackFields(t *testing.T) {
	var page struct{ Tracks []struct{ Source string } }
	raw := Stamp(json.RawMessage(`{"tracks":[{"id":"1","name":"minimal"}]}`), "instance")
	if e := json.Unmarshal(raw, &page); e != nil || page.Tracks[0].Source != "instance" {
		t.Fatal(string(raw), e)
	}
}
