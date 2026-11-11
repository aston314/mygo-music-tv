package sources

import (
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
	ID         string `json:"id"`
	Repository string `json:"repository"`
	State      string `json:"state"`
	Message    string `json:"message,omitempty"`
	InstanceID string `json:"instanceId,omitempty"`
}
type instance struct {
	sync.Mutex
	info Info
	p    *plugin.Plugin
}
type Manager struct {
	mu     sync.RWMutex
	root   string
	items  map[string]*instance
	jobs   map[string]Job
	closed bool
	wg     sync.WaitGroup
}

func Key(repo string) string {
	sum := sha256.Sum256([]byte(strings.ToLower(repo)))
	return hex.EncodeToString(sum[:12])
}
func New(root string) (*Manager, error) {
	m := &Manager{root: root, items: map[string]*instance{}, jobs: map[string]Job{}}
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
	for _, j := range m.jobs {
		if strings.EqualFold(j.Repository, repo) && (j.State == "downloading" || j.State == "installing") {
			return j, nil
		}
	}
	job := Job{ID: fmt.Sprintf("%s-%d", id, time.Now().UnixNano()), Repository: repo, State: "downloading", InstanceID: id}
	m.jobs[job.ID] = job
	m.wg.Add(1)
	go m.install(job)
	return job, nil
}
func (m *Manager) set(j Job, state, msg string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	j.State = state
	j.Message = msg
	m.jobs[j.ID] = j
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
		m.set(j, "failed", e.Error())
		return
	}
	m.set(j, "complete", "")
}
func (m *Manager) installRepo(j Job) error {
	base := filepath.Join(m.root, j.InstanceID)
	dir := filepath.Join(base, "plugins")
	pending, e := plugin.Fetch(j.Repository, dir)
	if e != nil {
		return e
	}
	defer pending.Discard()
	m.set(j, "installing", "")
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.closed {
		return errors.New("正在退出")
	}
	// Data lives outside the versioned plugin folder. Different repositories never share it.
	if old := m.items[j.InstanceID]; old != nil {
		old.p.Close()
		if old.info.Manifest.ID != pending.Manifest.ID {
			return errors.New("插件更新更改了 ID，请先卸载旧版本")
		}
	}
	if e = pending.Install(dir); e != nil {
		return e
	}
	b, _ := json.Marshal(map[string]string{"repository": j.Repository})
	if e = os.WriteFile(filepath.Join(base, "instance.json"), b, 0600); e != nil {
		return e
	}
	it, e := m.load(j.InstanceID, j.Repository)
	if e != nil {
		return e
	}
	m.items[j.InstanceID] = it
	return nil
}

// AddFixture loads the bundled test plugin only in explicit preview mode.
func (m *Manager) AddFixture(dir string) error {
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
	if e := it.p.Remove(nil); e != nil {
		return e
	}
	delete(m.items, id)
	return nil
}
func (m *Manager) Close() {
	m.mu.Lock()
	m.closed = true
	for _, it := range m.items {
		it.p.Close()
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
			for _, v := range x {
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
