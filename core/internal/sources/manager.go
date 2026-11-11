package sources

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"mygo-music-tv/core/internal/music"
	"mygo-music-tv/core/internal/plugin"
)

var Methods = strings.Fields("signIn signOut account search suggest playlists playlist album artist liked recent home browse isLiked like likeEpisode createPlaylist renamePlaylist deletePlaylist addToPlaylist removeFromPlaylist movePlaylistTrack savePlaylist followArtist saveAlbum savedAlbums shows show subscribeShow stations stationNext comments likeComment postComment lyrics stream played remotePlay remotePause remoteResume remoteSeek remoteVolume remoteState remoteDevices remoteUse")

type Info struct {
	InstanceID   string          `json:"instanceId"`
	Repository   string          `json:"repository"`
	Revision     string          `json:"revision"`
	Manifest     music.Info      `json:"manifest"`
	Capabilities map[string]bool `json:"capabilities"`
	Process      []string        `json:"process"`
	Verification string          `json:"verification"`
}
type Job struct {
	ID           string             `json:"id"`
	Repository   string             `json:"repository"`
	State        string             `json:"state"`
	Message      string             `json:"message,omitempty"`
	InstanceID   string             `json:"instanceId,omitempty"`
	Operation    string             `json:"operation,omitempty"`
	Version      string             `json:"version,omitempty"`
	BaseRevision string             `json:"-"`
	Permissions  plugin.Permissions `json:"permissions,omitempty"`
}
type instance struct {
	info Info
	p    *plugin.Plugin
}
type Manager struct {
	mu           sync.RWMutex
	root         string
	items        map[string]*instance
	jobs         map[string]Job
	closed       bool
	wg           sync.WaitGroup
	fetch        func(context.Context, string, string) (*plugin.Pending, error)
	ctx          context.Context
	cancel       context.CancelFunc
	latest       func(context.Context, string) (*plugin.Release, error)
	fetchRelease func(context.Context, *plugin.Release, string) (*plugin.Pending, error)
	updates      map[string]cachedUpdate
	pending      map[string]*plugin.Pending
	checkSlots   chan struct{}
	// GuardUpdate holds the player state stable while activation replaces code.
	GuardUpdate func(string) (func(), error)
}

func Key(repo string) string {
	sum := sha256.Sum256([]byte(strings.ToLower(repo)))
	return hex.EncodeToString(sum[:12])
}
func New(root string) (*Manager, error) {
	ctx, cancel := context.WithCancel(context.Background())
	m := &Manager{root: root, items: map[string]*instance{}, jobs: map[string]Job{}, ctx: ctx, cancel: cancel, latest: plugin.LatestContext, fetchRelease: plugin.FetchReleaseContext, updates: map[string]cachedUpdate{}, pending: map[string]*plugin.Pending{}, checkSlots: make(chan struct{}, 3)}
	m.fetch = func(ctx context.Context, repo, dir string) (*plugin.Pending, error) {
		rel, e := m.latest(ctx, repo)
		if e != nil {
			return nil, e
		}
		return m.fetchRelease(ctx, rel, dir)
	}
	if err := os.MkdirAll(root, 0700); err != nil {
		return nil, err
	}
	dirs, err := os.ReadDir(root)
	if err != nil {
		return nil, err
	}
	for _, d := range dirs {
		if !d.IsDir() || strings.HasPrefix(d.Name(), ".") {
			continue
		}
		var meta struct {
			Repository string `json:"repository"`
		}
		b, e := os.ReadFile(filepath.Join(root, d.Name(), "instance.json"))
		if e != nil {
			continue
		}
		if json.Unmarshal(b, &meta) != nil || Key(meta.Repository) != d.Name() {
			continue
		}
		if it, e := m.load(d.Name(), meta.Repository); e == nil {
			m.items[d.Name()] = it
		}
	}
	m.loadUpdates()
	return m, nil
}
func (m *Manager) load(id, repo string) (*instance, error) {
	dir := filepath.Join(m.root, id)
	dirs, e := os.ReadDir(filepath.Join(dir, "plugins"))
	if e != nil {
		return nil, e
	}
	for _, d := range dirs {
		if !d.IsDir() || strings.HasPrefix(d.Name(), ".") {
			continue
		}
		p, e := plugin.Load(filepath.Join(dir, "plugins", d.Name()), filepath.Join(dir, "data"))
		if e != nil {
			return nil, e
		}
		p.DisableProcesses()
		info := Info{InstanceID: id, Repository: repo, Manifest: p.Info(), Capabilities: map[string]bool{}, Process: p.Permissions().Process, Verification: "installed-unverified"}
		if o := p.Origin(); o != nil {
			info.Revision = o.Version
		}
		for _, method := range Methods {
			if p.Can(method) {
				info.Capabilities[method] = true
			}
		}
		return &instance{info: info, p: p}, nil
	}
	return nil, errors.New("插件文件不存在")
}
func (m *Manager) List() []Info {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := []Info{}
	for _, it := range m.items {
		out = append(out, it.info)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Repository < out[j].Repository })
	return out
}
func (m *Manager) Get(id string) (*plugin.Plugin, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if m.closed {
		return nil, errors.New("音乐服务正在退出")
	}
	it := m.items[id]
	if it == nil {
		return nil, errors.New("此音乐源未安装")
	}
	return it.p, nil
}
func (m *Manager) Start(repo string) (Job, error) {
	repo, e := plugin.ParseRepo(repo)
	if e != nil {
		return Job{}, e
	}
	id := Key(repo)
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.closed {
		return Job{}, errors.New("正在退出")
	}
	if m.items[id] != nil {
		return Job{}, errors.New("插件已安装，请先检查更新")
	}
	for _, j := range m.jobs {
		if strings.EqualFold(j.Repository, repo) && jobBusy(j) {
			return j, nil
		}
	}
	job := Job{ID: fmt.Sprintf("%s-%d", id, time.Now().UnixNano()), Repository: repo, State: "downloading", InstanceID: id, Operation: "install"}
	m.jobs[job.ID] = job
	m.wg.Add(1)
	go m.install(job)
	return job, nil
}
func (m *Manager) set(j Job, state, msg string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if saved, ok := m.jobs[j.ID]; ok {
		j = saved
	}
	j.State = state
	j.Message = msg
	m.jobs[j.ID] = j
	if j.Operation == "update" {
		u := m.updates[j.InstanceID]
		u.State = state
		if state == "complete" {
			u.State = "current"
			u.JobID = ""
		}
		u.Message = msg
		if state == "failed" {
			u.State = "updateFailed"
		}
		m.updates[j.InstanceID] = u
	}
}
func (m *Manager) Job(id string) (Job, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	j, ok := m.jobs[id]
	return j, ok
}
func (m *Manager) install(j Job) {
	defer m.wg.Done()
	if e := m.installRepo(j); e != nil {
		if errors.Is(e, errConfirmation) {
			return
		}
		m.set(j, "failed", e.Error())
		return
	}
	m.set(j, "complete", "")
}
func (m *Manager) installRepo(j Job) error {
	dir := filepath.Join(m.root, j.InstanceID, "plugins")
	ctx := plugin.WithInstallProgress(m.ctx, func(phase string) {
		msg := ""
		if phase == "retrying" {
			msg = "正在尝试备用线路…"
		}
		m.set(j, "downloading", msg)
	})
	var pending *plugin.Pending
	var e error
	if j.Operation == "update" {
		m.mu.RLock()
		cached := m.updates[j.InstanceID]
		m.mu.RUnlock()
		if cached.Release == nil || cached.Release.Version != j.Version {
			return errors.New("更新版本已变化，请重新检查")
		}
		pending, e = m.fetchRelease(ctx, cached.Release, dir)
	} else {
		pending, e = m.fetch(ctx, j.Repository, dir)
	}
	if e != nil {
		return e
	}
	e = m.activate(j, pending, false)
	if !errors.Is(e, errConfirmation) {
		pending.Discard()
	}
	return e
}

func (m *Manager) activate(j Job, pending *plugin.Pending, approved bool) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.closed {
		return errors.New("正在退出")
	}
	old := m.items[j.InstanceID]
	if j.Operation == "update" && (old == nil || old.info.Revision != j.BaseRevision || pending.Version != j.Version) {
		return errors.New("更新版本已变化，请重新检查")
	}
	if old != nil && old.info.Manifest.ID != pending.Manifest.ID {
		return errors.New("插件更新更改了 ID，请先卸载旧版本")
	}
	if old != nil && !approved {
		added := addedPermissions(old.p.Permissions(), pending.Manifest.Permissions)
		if len(added.Network) > 0 || len(added.Process) > 0 {
			j.State = "awaiting-confirmation"
			j.Permissions = added
			m.jobs[j.ID] = j
			m.pending[j.ID] = pending
			u := m.updates[j.InstanceID]
			u.State = j.State
			m.updates[j.InstanceID] = u
			return errConfirmation
		}
	}
	if old != nil && m.GuardUpdate != nil {
		release, e := m.GuardUpdate(j.InstanceID)
		if e != nil {
			return e
		}
		defer release()
	}
	j.State = "installing"
	if j.ID != "" {
		m.jobs[j.ID] = j
	}
	base := filepath.Join(m.root, j.InstanceID)
	dir := filepath.Join(base, "plugins")
	var it *instance
	e := pending.InstallValidated(dir, func() error {
		var e error
		it, e = m.load(j.InstanceID, j.Repository)
		if e != nil {
			return e
		}
		b, _ := json.Marshal(map[string]string{"repository": j.Repository})
		meta := filepath.Join(base, "instance.json")
		if e = os.WriteFile(meta+".part", b, 0600); e == nil {
			e = os.Rename(meta+".part", meta)
		}
		if e != nil {
			os.Remove(meta + ".part")
			it.p.Retire()
		}
		return e
	})
	if e != nil {
		return e
	}
	if old != nil {
		old.p.Retire()
	}
	m.items[j.InstanceID] = it
	m.updates[j.InstanceID] = cachedUpdate{Update: Update{InstanceID: j.InstanceID, CurrentVersion: it.info.Manifest.Version, Revision: it.info.Revision, LatestVersion: it.info.Revision, State: "current", CheckedAt: time.Now().UTC(), AttemptedAt: time.Now().UTC()}, Release: &pending.Release}
	m.saveUpdatesLocked()
	return nil
}

// AddFixture loads the bundled test plugin only in explicit preview mode.
func (m *Manager) AddFixture(dir string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	p, e := plugin.Load(dir, filepath.Join(m.root, ".fixture-data"))
	if e != nil {
		return e
	}
	p.DisableProcesses()
	info := Info{InstanceID: "fixture", Repository: "fixture/demo", Manifest: p.Info(), Capabilities: map[string]bool{}, Verification: "fixture"}
	for _, method := range Methods {
		info.Capabilities[method] = p.Can(method)
	}
	m.items["fixture"] = &instance{info: info, p: p}
	return nil
}
func (m *Manager) Remove(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	it := m.items[id]
	if it == nil {
		return errors.New("未安装")
	}
	if id == "fixture" {
		return errors.New("预览来源由运行模式管理")
	}
	for _, j := range m.jobs {
		if j.InstanceID == id && jobBusy(j) {
			return errors.New("插件正在处理安装或更新，请稍后重试")
		}
	}
	it.p.Retire()
	if e := it.p.Remove(nil); e != nil {
		return e
	}
	delete(m.items, id)
	delete(m.updates, id)
	m.saveUpdatesLocked()
	return nil
}
func (m *Manager) Close() {
	m.mu.Lock()
	m.closed = true
	m.cancel()
	for id, p := range m.pending {
		p.Discard()
		delete(m.pending, id)
	}
	for _, it := range m.items {
		it.p.Retire()
	}
	m.mu.Unlock()
	m.wg.Wait()
}

// Stamp rewrites only track source identity, preserving the plugin's own IDs.
func Stamp(raw json.RawMessage, id string) json.RawMessage {
	var value any
	if json.Unmarshal(raw, &value) != nil {
		return raw
	}
	var walk func(any)
	walk = func(v any) {
		switch x := v.(type) {
		case map[string]any:
			if _, ok := x["source"]; ok {
				x["source"] = id
			}
			if _, ok := x["duration"]; ok {
				if _, ok = x["album"]; ok {
					x["source"] = id
				}
			}
			for key, v := range x {
				if key == "tracks" || key == "episodes" {
					if tracks, ok := v.([]any); ok {
						for _, t := range tracks {
							if track, ok := t.(map[string]any); ok {
								track["source"] = id
							}
						}
					}
				}
				walk(v)
			}
		case []any:
			for _, v := range x {
				walk(v)
			}
		}
	}
	walk(value)
	b, e := json.Marshal(value)
	if e != nil {
		return raw
	}
	return b
}
