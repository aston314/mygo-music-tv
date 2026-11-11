package server

import (
	"errors"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"mygo-music-tv/core/internal/music"
	"mygo-music-tv/core/internal/plugin"
)

type Playback struct {
	Generation       int64         `json:"generation"`
	Revision         int64         `json:"revision"`
	State            string        `json:"state"`
	Queue            []music.Track `json:"queue"`
	Index            int           `json:"index"`
	Media            string        `json:"media,omitempty"`
	Position         int64         `json:"position"`
	Duration         int64         `json:"duration"`
	WantPlay         bool          `json:"wantPlay"`
	Error            string        `json:"error,omitempty"`
	Remote           bool          `json:"remote"`
	Device           string        `json:"device,omitempty"`
	Mode             string        `json:"mode"`
	EntryIDs         []string      `json:"entryIds"`
	QueueRevision    int64         `json:"queueRevision"`
	PositionAt       int64         `json:"positionAt"`
	SeekRevision     int64         `json:"seekRevision"`
	Quality          string        `json:"quality,omitempty"`
	Station          *Station      `json:"station,omitempty"`
	Restored         bool          `json:"restored,omitempty"`
	PersistenceError string        `json:"persistenceError,omitempty"`
}
type player struct {
	sync.Mutex
	state           Playback
	server          *Server
	recorded        int64
	remoteMu        sync.Mutex
	remote          *plugin.Plugin
	closed          bool
	modePath        string
	history         []string
	historyAt       int
	bag             []string
	nextEntries     []string
	sessionPath     string
	savedAt         time.Time
	artwork         map[string]string
	stationGen      int64
	stationAwaiting bool
	lastEnded       int64
}

func (p *player) snapshot() Playback {
	p.Lock()
	defer p.Unlock()
	s := p.state
	s.Queue = append([]music.Track{}, s.Queue...)
	s.EntryIDs = append([]string{}, s.EntryIDs...)
	if s.Station != nil {
		station := *s.Station
		s.Station = &station
	}
	return s
}
func (p *player) resolve(gen int64, t music.Track) {
	src, e := p.server.sources.Get(t.Source)
	if e != nil {
		p.fail(gen, e.Error())
		return
	}
	// Serialize remote commands: a delayed old play must finish and be paused
	// before a new remote or local source can start.
	p.remoteMu.Lock()
	p.Lock()
	current := p.state.Generation == gen && !p.closed
	p.Unlock()
	if !current {
		p.remoteMu.Unlock()
		return
	}
	if p.remote != nil {
		_ = p.remote.RemotePause()
		p.remote = nil
	}
	p.Lock()
	position := p.state.Position
	p.Unlock()
	if src.Info().Playback == music.PlaybackRemote {
		p.Lock()
		p.state.Remote = true
		p.Unlock()
		if e := src.RemotePlay([]string{t.ID}, 0, position); e != nil {
			p.remoteMu.Unlock()
			p.fail(gen, e.Error())
			return
		}
		p.Lock()
		if p.state.Generation != gen || p.closed {
			p.Unlock()
			_ = src.RemotePause()
			p.remoteMu.Unlock()
			return
		}
		wantPlay := p.state.WantPlay
		p.state.Revision++
		p.Unlock()
		p.remote = src
		if !wantPlay {
			_ = src.RemotePause()
		}
		p.remoteMu.Unlock()
		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()
		for range ticker.C {
			p.remoteMu.Lock()
			p.Lock()
			current := p.state.Generation == gen && !p.closed
			p.Unlock()
			if !current {
				p.remoteMu.Unlock()
				return
			}
			s, e := src.RemoteState()
			if e != nil {
				p.remoteMu.Unlock()
				p.fail(gen, e.Error())
				return
			}
			if s == nil {
				p.remoteMu.Unlock()
				continue
			}
			p.Lock()
			if p.state.Generation != gen {
				p.Unlock()
				p.remoteMu.Unlock()
				return
			}
			p.state.Device = s.Device
			p.state.WantPlay = s.Playing
			p.Unlock()
			status := "paused"
			if s.Playing {
				status = "playing"
			}
			p.event(gen, status, s.Position, s.Duration)
			p.remoteMu.Unlock()
		}
		return
	}
	p.remoteMu.Unlock()
	p.server.mu.Lock()
	quality := p.server.settings["quality"]
	p.server.mu.Unlock()
	stream, e := src.Stream(t.ID, quality)
	if e != nil {
		p.fail(gen, e.Error())
		return
	}
	fixture := t.Source == "fixture" && p.server.mode != "real"
	address := stream.URL
	if fixture && strings.HasPrefix(address, "file://") {
		local, ok := music.PathOf(address)
		if !ok || filepath.Clean(local) != filepath.Join(p.server.fixtureDir, "tone.mp3") {
			p.fail(gen, "预览媒体无效")
			return
		}
		address = local
	} else if !strings.HasPrefix(address, "https://") && !strings.HasPrefix(address, "http://") {
		p.fail(gen, "此播放分支需要平台适配，当前仅支持 HTTP 音频流")
		return
	}
	p.Lock()
	defer p.Unlock()
	if p.state.Generation != gen {
		return
	}
	p.state.Media = p.server.media.add(address, stream.Headers, 6*time.Hour, fixture)
	p.state.State = "ready"
	p.state.Quality = stream.Quality
	p.state.Revision++
}
func (p *player) fail(gen int64, msg string) {
	p.Lock()
	defer p.Unlock()
	if p.state.Generation == gen {
		p.state.State = "failed"
		p.state.Error = msg
		p.state.WantPlay = false
		p.state.Revision++
		p.saveSessionLocked(true)
	}
}
func (p *player) control(action string, pos int64) error {
	var s Playback
	switch action {
	case "station-retry", "leave-station":
		p.Lock()
		defer p.Unlock()
		if p.closed {
			return errors.New("音乐服务正在退出")
		}
		if action == "leave-station" {
			p.endStationLocked()
		} else {
			if p.state.Station == nil {
				return errors.New("当前没有正在播放的电台")
			}
			if p.state.State == "ended" {
				p.stationAwaiting = true
				p.state.WantPlay = true
			}
			p.refillStationLocked(true)
		}
		p.state.Revision++
		p.state.QueueRevision++
		p.saveSessionLocked(true)
		return nil
	case "next":
		return p.advance(1, false, 0)
	case "previous":
		return p.advance(-1, false, 0)
	case "retry":
		p.Lock()
		defer p.Unlock()
		if len(p.state.Queue) == 0 {
			return errors.New("播放队列为空")
		}
		p.beginLocked(p.state.Index)
		return nil
	case "pause", "resume", "seek", "stop":
	default:
		return errors.New("未知播放操作")
	}
	p.remoteMu.Lock()
	defer p.remoteMu.Unlock()
	s = p.snapshot()
	if pos < 0 {
		pos = 0
	}
	if s.Duration > 0 && pos > s.Duration {
		pos = s.Duration
	}
	if s.Remote && len(s.Queue) > s.Index {
		src, e := p.server.sources.Get(s.Queue[s.Index].Source)
		if e != nil {
			return e
		}
		switch action {
		case "pause", "stop":
			e = src.RemotePause()
		case "resume":
			e = src.RemoteResume()
		case "seek":
			e = src.RemoteSeek(pos)
		}
		if e != nil {
			return e
		}
	}
	p.Lock()
	defer p.Unlock()
	if p.state.Generation != s.Generation || p.closed {
		return nil
	}
	p.state.Revision++
	p.state.PositionAt = time.Now().UnixMilli()
	switch action {
	case "pause":
		p.state.WantPlay = false
		p.state.State = "paused"
	case "resume":
		if p.stationAwaiting {
			p.state.WantPlay = true
			p.state.State = "buffering"
			p.saveSessionLocked(true)
			return nil
		}
		if p.state.Media == "" && !p.state.Remote && p.state.State != "preparing" && len(p.state.Queue) > 0 {
			p.beginAtLocked(p.state.Index, p.state.Position)
			return nil
		}
		p.state.WantPlay = true
		if p.state.Media != "" {
			p.state.State = "ready"
		}
	case "seek":
		if pos < 0 {
			pos = 0
		}
		if p.state.Duration > 0 && pos > p.state.Duration {
			pos = p.state.Duration
		}
		p.state.Position = pos
		p.state.SeekRevision++
	case "stop":
		p.endStationLocked()
		p.state.Generation++
		p.server.media.revoke(p.state.Media)
		p.state.Media = ""
		p.state.WantPlay = false
		p.state.State = "idle"
		p.state.Remote = false
		p.state.Device = ""
		p.remote = nil
	}
	p.saveSessionLocked(true)
	return nil
}

func (p *player) close() {
	p.Lock()
	p.saveSessionLocked(true)
	p.closed = true
	p.endStationLocked()
	p.state.Generation++
	p.Unlock()
}
func (p *player) event(gen int64, state string, pos, duration int64, seekAck ...int64) bool {
	valid := map[string]bool{"playing": true, "paused": true, "buffering": true, "ended": true, "failed": true}
	if !valid[state] {
		return false
	}
	p.Lock()
	if gen != p.state.Generation || p.closed || p.state.State == "ended" || p.stationAwaiting || state == "ended" && p.lastEnded == gen || len(seekAck) > 0 && seekAck[0] != p.state.SeekRevision {
		p.Unlock()
		return false
	}
	p.state.State = state
	p.state.PositionAt = time.Now().UnixMilli()
	if pos >= 0 {
		p.state.Position = pos
	}
	if duration > 0 {
		p.state.Duration = duration
	}
	if state == "failed" {
		p.state.Error = "音频播放失败，请重试或切换音乐源"
		p.state.WantPlay = false
	}
	if state == "ended" {
		p.state.WantPlay = false
		p.lastEnded = gen
	}
	p.saveSessionLocked(state != "playing" && state != "buffering")
	// Only the first confirmed playing event records listening history.
	record := state == "playing" && p.recorded != gen
	if record {
		p.recorded = gen
		p.server.wg.Add(1)
	}
	var track music.Track
	if record && len(p.state.Queue) > p.state.Index {
		track = p.state.Queue[p.state.Index]
	}
	p.Unlock()
	if record && track.ID != "" {
		go func() {
			defer p.server.wg.Done()
			if src, e := p.server.sources.Get(track.Source); e == nil && src.Can("played") {
				src.Played(track)
			}
		}()
	} else if record {
		p.server.wg.Done()
	}
	if state == "ended" {
		_ = p.advance(1, true, gen)
	}
	return true
}

// The manager holds its lock before acquiring the player lock. Activation never
// changes playback; preparing and remote sessions must finish before replacement.
func (p *player) guardPluginUpdate(id string) (func(), error) {
	p.Lock()
	s := p.state
	if s.Index >= 0 && s.Index < len(s.Queue) && s.Queue[s.Index].Source == id && (s.State == "preparing" || s.Remote && s.State != "idle" && s.State != "ended" && s.State != "failed") {
		p.Unlock()
		return nil, errors.New("此音乐源正在准备播放或控制远端设备，请结束播放后重试更新")
	}
	return p.Unlock, nil
}
