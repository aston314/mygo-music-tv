package server

import (
	"encoding/json"
	"errors"
	"math/rand/v2"
	"os"
	"slices"
	"time"

	"mygo-music-tv/core/internal/music"
)

func newPlayer(s *Server, path string) *player {
	p := &player{server: s, modePath: path, historyAt: -1, state: Playback{State: "idle", Mode: "sequence", Queue: []music.Track{}, EntryIDs: []string{}}}
	var saved struct{ Mode string }
	if b, e := os.ReadFile(path); e == nil && json.Unmarshal(b, &saved) == nil && validMode(saved.Mode) {
		p.state.Mode = saved.Mode
	}
	return p
}

func validMode(mode string) bool {
	return mode == "sequence" || mode == "loop" || mode == "single" || mode == "shuffle"
}

func (p *player) setMode(mode string) error {
	if !validMode(mode) {
		return errors.New("未知播放模式")
	}
	p.Lock()
	defer p.Unlock()
	if err := p.stationModeError(); err != nil {
		return err
	}
	b, _ := json.Marshal(map[string]string{"mode": mode})
	if err := os.WriteFile(p.modePath+".part", b, 0600); err != nil {
		return err
	}
	if err := os.Rename(p.modePath+".part", p.modePath); err != nil {
		return err
	}
	p.state.Mode = mode
	p.bag = nil
	p.state.Revision++
	p.saveSessionLocked(true)
	return nil
}

func (p *player) validateTracks(queue []music.Track) error {
	if len(queue) == 0 || len(queue) > 1000 {
		return errors.New("播放队列无效，最多 1000 首")
	}
	for _, t := range queue {
		if t.ID == "" {
			return errors.New("歌曲 ID 为空")
		}
		if _, e := p.server.sources.Get(t.Source); e != nil {
			return e
		}
	}
	return nil
}

func (p *player) play(queue []music.Track, index int) error {
	return p.playWithStation(queue, index, nil)
}

func (p *player) playWithStation(queue []music.Track, index int, station *Station) error {
	if e := p.validateTracks(queue); e != nil {
		return e
	}
	if index < 0 || index >= len(queue) {
		return errors.New("歌曲位置无效")
	}
	if station != nil {
		src, err := p.server.sources.Get(station.Source)
		if err != nil {
			return err
		}
		if station.ID == "" || !src.Can("stationNext") || src.Info().Playback == music.PlaybackRemote {
			return errors.New("此音乐源不支持连续电台")
		}
		for _, t := range queue {
			if t.Source != station.Source {
				return errors.New("电台歌曲来源不一致")
			}
		}
	}
	p.Lock()
	defer p.Unlock()
	if p.closed {
		return errors.New("音乐服务正在退出")
	}
	p.state.Queue = append([]music.Track{}, queue...)
	p.state.EntryIDs = make([]string, len(queue))
	for i := range queue {
		p.state.EntryIDs[i] = randomID()
	}
	p.state.QueueRevision++
	p.history = []string{p.state.EntryIDs[index]}
	p.historyAt = 0
	p.bag = nil
	p.nextEntries = nil
	p.endStationLocked()
	if station != nil {
		p.state.Station = &Station{Source: station.Source, ID: station.ID, Name: station.Name}
	}
	p.beginLocked(index)
	return nil
}

// All queue changes preserve entry identity, including duplicate songs.
func (p *player) beginLocked(index int) {
	p.beginAtLocked(index, 0)
}

func (p *player) beginAtLocked(index int, position int64) {
	old := p.state.Media
	id := p.state.EntryIDs[index]
	p.nextEntries = slices.DeleteFunc(p.nextEntries, func(x string) bool { return x == id })
	p.bag = slices.DeleteFunc(p.bag, func(x string) bool { return x == id })
	p.state.Generation++
	p.state.Revision++
	p.state.Index = index
	p.keepArtworkLocked()
	p.state.Media = ""
	p.state.Position = position
	p.state.SeekRevision = 0
	p.state.PositionAt = time.Now().UnixMilli()
	p.state.Duration = p.state.Queue[index].Duration
	p.state.State = "preparing"
	p.state.WantPlay = true
	p.state.Error = ""
	p.state.Remote = false
	p.state.Device = ""
	p.state.Quality = ""
	p.state.Restored = false
	p.stationAwaiting = false
	gen, track := p.state.Generation, p.state.Queue[index]
	p.server.media.revoke(old)
	p.server.wg.Add(1)
	go func() { defer p.server.wg.Done(); p.resolve(gen, track) }()
	p.refillStationLocked(false)
	p.saveSessionLocked(true)
}

func (p *player) rememberLocked(index int) {
	id := p.state.EntryIDs[index]
	p.history = append(p.history[:p.historyAt+1], id)
	if len(p.history) > 2000 {
		p.history = p.history[len(p.history)-2000:]
	}
	p.historyAt = len(p.history) - 1
}

// expected prevents a late ended event from advancing a newly selected song.
func (p *player) advance(direction int, automatic bool, expected int64) error {
	p.Lock()
	defer p.Unlock()
	if p.closed {
		return errors.New("音乐服务正在退出")
	}
	if len(p.state.Queue) == 0 || automatic && p.state.Generation != expected {
		return nil
	}
	i := p.state.Index
	if p.state.Station != nil {
		if direction < 0 {
			if i > 0 {
				p.rememberLocked(i - 1)
				p.beginLocked(i - 1)
			}
			return nil
		}
		if i+1 < len(p.state.Queue) {
			p.rememberLocked(i + 1)
			p.beginLocked(i + 1)
			return nil
		}
		st := p.state.Station
		if st.Error == "" && !st.Exhausted {
			p.stationAwaiting = true
			p.state.State = "buffering"
			p.state.WantPlay = true
			p.refillStationLocked(false)
		}
		p.saveSessionLocked(true)
		return nil
	}
	if automatic && p.state.Mode == "single" {
		p.beginLocked(i)
		return nil
	}
	if p.state.Mode == "shuffle" {
		if direction < 0 {
			for at := p.historyAt - 1; at >= 0; at-- {
				if n := slices.Index(p.state.EntryIDs, p.history[at]); n >= 0 {
					p.historyAt = at
					p.beginLocked(n)
					return nil
				}
			}
			return nil
		}
		for len(p.nextEntries) > 0 {
			id := p.nextEntries[0]
			p.nextEntries = p.nextEntries[1:]
			if n := slices.Index(p.state.EntryIDs, id); n >= 0 {
				p.bag = slices.DeleteFunc(p.bag, func(x string) bool { return x == id })
				p.rememberLocked(n)
				p.beginLocked(n)
				return nil
			}
		}
		for at := p.historyAt + 1; at < len(p.history); at++ {
			if n := slices.Index(p.state.EntryIDs, p.history[at]); n >= 0 {
				p.historyAt = at
				p.beginLocked(n)
				return nil
			}
		}
		if len(p.bag) == 0 {
			for n, id := range p.state.EntryIDs {
				if n != i {
					p.bag = append(p.bag, id)
				}
			}
			rand.Shuffle(len(p.bag), func(a, b int) { p.bag[a], p.bag[b] = p.bag[b], p.bag[a] })
		}
		if len(p.bag) > 0 {
			i = slices.Index(p.state.EntryIDs, p.bag[0])
			p.bag = p.bag[1:]
		}
	} else {
		i += direction
		if i < 0 || i >= len(p.state.Queue) {
			if p.state.Mode == "loop" || p.state.Mode == "single" {
				i = (i + len(p.state.Queue)) % len(p.state.Queue)
			} else {
				return nil
			}
		}
	}
	p.rememberLocked(i)
	p.beginLocked(i)
	return nil
}

type QueueChange struct {
	Action  string        `json:"action"`
	EntryID string        `json:"entryId"`
	Tracks  []music.Track `json:"tracks"`
}

func (p *player) changeQueue(q QueueChange) error {
	if q.Action == "append" || q.Action == "next" {
		if e := p.validateTracks(q.Tracks); e != nil {
			return e
		}
	}
	p.remoteMu.Lock()
	defer p.remoteMu.Unlock()
	p.Lock()
	defer p.Unlock()
	if p.closed {
		return errors.New("音乐服务正在退出")
	}
	s := &p.state
	i := slices.Index(s.EntryIDs, q.EntryID)
	switch q.Action {
	case "clear":
		return p.clearLocked()
	case "append", "next":
		if len(s.Queue)+len(q.Tracks) > 1000 {
			return errors.New("队列最多 1000 首")
		}
		at := len(s.Queue)
		if q.Action == "next" && at > 0 {
			at = s.Index + 1
		}
		s.Queue = slices.Insert(s.Queue, at, q.Tracks...)
		ids := make([]string, len(q.Tracks))
		for n := range ids {
			ids[n] = randomID()
		}
		s.EntryIDs = slices.Insert(s.EntryIDs, at, ids...)
		if q.Action == "next" {
			p.nextEntries = append(ids, p.nextEntries...)
		}
	case "jump":
		if i < 0 {
			return errors.New("此歌曲已移出队列，请刷新")
		}
		p.rememberLocked(i)
		p.beginLocked(i)
		return nil
	case "remove":
		if i < 0 {
			return errors.New("此歌曲已移出队列，请刷新")
		}
		if len(s.Queue) == 1 {
			return p.clearLocked()
		}
		s.Queue = slices.Delete(s.Queue, i, i+1)
		s.EntryIDs = slices.Delete(s.EntryIDs, i, i+1)
		if i < s.Index {
			s.Index--
		} else if i == s.Index {
			next := min(i, len(s.Queue)-1)
			p.rememberLocked(next)
			p.beginLocked(next)
		}
	default:
		return errors.New("未知队列操作")
	}
	s.QueueRevision++
	s.Revision++
	p.bag = nil
	p.refillStationLocked(false)
	p.saveSessionLocked(true)
	return nil
}

// Called with both remoteMu and the state mutex held.
func (p *player) clearLocked() error {
	if p.remote != nil {
		if e := p.remote.RemotePause(); e != nil {
			return e
		}
		p.remote = nil
	}
	p.endStationLocked()
	p.server.media.revoke(p.state.Media)
	p.server.media.protectArtwork("")
	p.state.Generation++
	p.state.Revision++
	p.state.QueueRevision++
	p.state.Queue = []music.Track{}
	p.state.EntryIDs = []string{}
	p.state.Index = 0
	p.state.Position = 0
	p.state.Duration = 0
	p.state.Media = ""
	p.state.Remote = false
	p.state.Device = ""
	p.state.State = "idle"
	p.state.WantPlay = false
	p.state.Error = ""
	p.state.Quality = ""
	p.state.Restored = false
	p.history = nil
	p.historyAt = -1
	p.bag = nil
	p.nextEntries = nil
	p.saveSessionLocked(true)
	return nil
}
