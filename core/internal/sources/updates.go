package sources

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"mygo-music-tv/core/internal/plugin"
)

type Update struct {
	InstanceID     string    `json:"instanceId"`
	CurrentVersion string    `json:"currentVersion"`
	Revision       string    `json:"revision"`
	LatestVersion  string    `json:"latestVersion,omitempty"`
	Available      bool      `json:"available"`
	State          string    `json:"state"`
	Message        string    `json:"message,omitempty"`
	CheckedAt      time.Time `json:"checkedAt,omitempty"`
	AttemptedAt    time.Time `json:"attemptedAt,omitempty"`
	JobID          string    `json:"jobId,omitempty"`
}

type cachedUpdate struct {
	Update
	Release *plugin.Release `json:"release,omitempty"`
}

var errConfirmation = errors.New("awaiting permission confirmation")

func jobBusy(j Job) bool {
	return j.State == "downloading" || j.State == "installing" || j.State == "awaiting-confirmation"
}

func (m *Manager) loadUpdates() {
	b, e := os.ReadFile(filepath.Join(m.root, ".updates.json"))
	if e != nil {
		return
	}
	var saved map[string]cachedUpdate
	if json.Unmarshal(b, &saved) != nil {
		return
	}
	for id, u := range saved {
		it := m.items[id]
		if it == nil || it.info.Revision != u.Revision {
			continue
		}
		u.State = "idle"
		u.JobID = ""
		u.Message = ""
		if u.Release != nil && u.Release.Repo == it.info.Repository && u.Release.Version != "" && u.Release.URL != "" {
			u.LatestVersion = u.Release.Version
			u.Available = plugin.IsNewer(u.LatestVersion, u.Revision)
			if u.Available {
				u.State = "available"
			} else {
				u.State = "current"
			}
		} else {
			u.Release = nil
			u.Available = false
			u.AttemptedAt = time.Time{}
		}
		m.updates[id] = u
	}
}

func (m *Manager) saveUpdatesLocked() {
	b, e := json.Marshal(m.updates)
	if e != nil {
		return
	}
	path := filepath.Join(m.root, ".updates.json")
	if os.WriteFile(path+".part", b, 0600) == nil {
		_ = os.Rename(path+".part", path)
	}
}

func (m *Manager) Updates() []Update {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := []Update{}
	for id, it := range m.items {
		if id == "fixture" || it.info.Revision == "" {
			continue
		}
		u := m.updates[id].Update
		u.InstanceID = id
		u.CurrentVersion = it.info.Manifest.Version
		u.Revision = it.info.Revision
		if u.State == "" {
			u.State = "idle"
		}
		out = append(out, u)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].InstanceID < out[j].InstanceID })
	return out
}

// CheckUpdates schedules work and returns immediately, even if all routes fail.
func (m *Manager) CheckUpdates(id string, force bool) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.closed {
		return errors.New("正在退出")
	}
	if id != "" && (m.items[id] == nil || id == "fixture" || m.items[id].info.Revision == "") {
		return errors.New("此插件不支持在线更新")
	}
	for key, it := range m.items {
		if id != "" && id != key || key == "fixture" || it.info.Revision == "" {
			continue
		}
		u := m.updates[key]
		if u.State == "checking" || !force && time.Since(u.AttemptedAt) < 24*time.Hour {
			continue
		}
		busy := false
		for _, j := range m.jobs {
			if j.InstanceID == key && jobBusy(j) {
				busy = true
				break
			}
		}
		if busy {
			continue
		}
		u.InstanceID = key
		u.CurrentVersion = it.info.Manifest.Version
		u.Revision = it.info.Revision
		u.State = "checking"
		u.Message = ""
		u.JobID = ""
		u.AttemptedAt = time.Now().UTC()
		m.updates[key] = u
		m.wg.Add(1)
		go m.checkOne(key, it, u.AttemptedAt)
	}
	return nil
}

func (m *Manager) checkOne(id string, original *instance, started time.Time) {
	defer m.wg.Done()
	select {
	case m.checkSlots <- struct{}{}:
	case <-m.ctx.Done():
		return
	}
	defer func() { <-m.checkSlots }()
	ctx, cancel := context.WithTimeout(m.ctx, 45*time.Second)
	defer cancel()
	rel, e := m.latest(ctx, original.info.Repository)
	m.mu.Lock()
	defer m.mu.Unlock()
	u := m.updates[id]
	// Neither a removed/reinstalled instance nor an update may accept late results.
	if m.closed || m.items[id] != original || !u.AttemptedAt.Equal(started) || u.State != "checking" {
		return
	}
	if e != nil || rel == nil || rel.Version == "" || rel.Repo != original.info.Repository {
		u.State = "checkFailed"
		u.Message = "检查更新失败，请重试"
		if e != nil {
			u.Message = e.Error()
		}
	} else {
		u.Release = rel
		u.LatestVersion = rel.Version
		u.Available = plugin.IsNewer(rel.Version, original.info.Revision)
		u.CheckedAt = time.Now().UTC()
		u.State = "current"
		u.Message = ""
		if u.Available {
			u.State = "available"
		}
	}
	m.updates[id] = u
	m.saveUpdatesLocked()
}

func (m *Manager) StartUpdate(id, version string) (Job, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.closed {
		return Job{}, errors.New("正在退出")
	}
	it := m.items[id]
	u := m.updates[id]
	if it == nil {
		return Job{}, errors.New("此音乐源未安装")
	}
	for _, j := range m.jobs {
		if j.InstanceID == id && jobBusy(j) {
			return j, nil
		}
	}
	if !u.Available || u.Release == nil || u.Release.Version != version || u.Revision != it.info.Revision {
		return Job{}, errors.New("更新版本已变化，请重新检查")
	}
	j := Job{ID: fmt.Sprintf("%s-%d", id, time.Now().UnixNano()), InstanceID: id, Repository: it.info.Repository, Operation: "update", Version: version, BaseRevision: it.info.Revision, State: "downloading"}
	m.jobs[j.ID] = j
	u.State = "downloading"
	u.Message = ""
	u.JobID = j.ID
	m.updates[id] = u
	m.wg.Add(1)
	go m.install(j)
	return j, nil
}

// ConfirmUpdate resumes only the already downloaded and inspected version.
func (m *Manager) ConfirmUpdate(id string, allow bool) (Job, error) {
	m.mu.Lock()
	j, ok := m.jobs[id]
	pending := m.pending[id]
	if m.closed || !ok || pending == nil || j.State != "awaiting-confirmation" {
		m.mu.Unlock()
		return Job{}, errors.New("确认已失效，请重新检查更新")
	}
	delete(m.pending, id)
	if !allow {
		j.State = "cancelled"
		m.jobs[id] = j
		u := m.updates[j.InstanceID]
		u.State = "available"
		u.JobID = ""
		m.updates[j.InstanceID] = u
		m.mu.Unlock()
		pending.Discard()
		return j, nil
	}
	j.State = "installing"
	m.jobs[id] = j
	m.wg.Add(1)
	m.mu.Unlock()
	go func() {
		defer m.wg.Done()
		defer pending.Discard()
		if e := m.activate(j, pending, true); e != nil {
			m.set(j, "failed", e.Error())
		} else {
			m.set(j, "complete", "")
		}
	}()
	return j, nil
}

func addedPermissions(old, next plugin.Permissions) plugin.Permissions {
	added := plugin.Permissions{}
	for _, host := range next.Network {
		covered := false
		for _, was := range old.Network {
			if was == "*" || strings.EqualFold(was, host) || strings.HasPrefix(was, "*.") && strings.HasSuffix(strings.ToLower(host), strings.ToLower(was[1:])) {
				covered = true
				break
			}
		}
		if !covered {
			added.Network = append(added.Network, host)
		}
	}
	for _, program := range next.Process {
		covered := false
		for _, was := range old.Process {
			if was == program || was == "*" {
				covered = true
				break
			}
		}
		if !covered {
			added.Process = append(added.Process, program)
		}
	}
	return added
}

// Called in real mode only; preview fixtures never contact GitHub.
func (m *Manager) StartUpdateChecks() {
	m.mu.Lock()
	if m.closed {
		m.mu.Unlock()
		return
	}
	m.wg.Add(1)
	m.mu.Unlock()
	go func() {
		defer m.wg.Done()
		_ = m.CheckUpdates("", false)
		ticker := time.NewTicker(15 * time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-m.ctx.Done():
				return
			case <-ticker.C:
				_ = m.CheckUpdates("", false)
			}
		}
	}()
}
