package server

import (
	"encoding/json"
	"os"
	"slices"
	"strings"
	"time"

	"mygo-music-tv/core/internal/music"
)

// Persist metadata and confirmed position, never media leases or request headers.
type playbackSession struct {
	Version   int           `json:"version"`
	Queue     []music.Track `json:"queue"`
	EntryIDs  []string      `json:"entryIds"`
	Index     int           `json:"index"`
	Position  int64         `json:"position"`
	Duration  int64         `json:"duration"`
	History   []string      `json:"history,omitempty"`
	HistoryAt int           `json:"historyAt"`
	Bag       []string      `json:"bag,omitempty"`
	Next      []string      `json:"next,omitempty"`
	Station   *Station      `json:"station,omitempty"`
}

func (p *player) saveSessionLocked(force bool) {
	if p.sessionPath == "" || !force && time.Since(p.savedAt) < 5*time.Second {
		return
	}
	queue := append([]music.Track{}, p.state.Queue...)
	artwork := map[string]string{}
	image := func(path string) string {
		if !strings.HasPrefix(path, "/media/") {
			return path
		}
		p.server.media.Lock()
		l := p.server.media.leases[strings.TrimPrefix(path, "/media/")]
		address := p.artwork[path]
		if l != nil && !l.Fixture {
			address = l.URL
		}
		p.server.media.Unlock()
		artwork[path] = address
		return address
	}
	for i := range queue {
		queue[i].Album.ImageURL = image(queue[i].Album.ImageURL)
		queue[i].Artists = append([]music.Artist{}, queue[i].Artists...)
		queue[i].Album.Artists = append([]music.Artist{}, queue[i].Album.Artists...)
		for j := range queue[i].Artists {
			queue[i].Artists[j].ImageURL = image(queue[i].Artists[j].ImageURL)
		}
		for j := range queue[i].Album.Artists {
			queue[i].Album.Artists[j].ImageURL = image(queue[i].Album.Artists[j].ImageURL)
		}
	}
	p.artwork = artwork
	s := playbackSession{Version: 1, Queue: queue, EntryIDs: p.state.EntryIDs, Index: p.state.Index, Position: p.state.Position, Duration: p.state.Duration, History: p.history, HistoryAt: p.historyAt, Bag: p.bag, Next: p.nextEntries, Station: p.state.Station}
	b, err := json.Marshal(s)
	if err == nil {
		err = os.WriteFile(p.sessionPath+".part", b, 0600)
	}
	if err == nil {
		err = os.Rename(p.sessionPath+".part", p.sessionPath)
	}
	p.savedAt = time.Now()
	p.state.PersistenceError = ""
	if err != nil {
		p.state.PersistenceError = "播放记录保存失败，请检查存储空间"
	}
}

func (p *player) restoreSession(path string) {
	p.sessionPath = path
	info, err := os.Stat(path)
	if err != nil || info.Size() > 8<<20 {
		return
	}
	b, err := os.ReadFile(path)
	var saved playbackSession
	if err != nil || json.Unmarshal(b, &saved) != nil || saved.Version != 1 || len(saved.Queue) > 1000 {
		return
	}
	if len(saved.Queue) == 0 || saved.Index < 0 || saved.Index >= len(saved.Queue) {
		return
	}
	ids := map[string]bool{}
	index, retainedCurrent := 0, false
	for i, track := range saved.Queue {
		src, e := p.server.sources.Get(track.Source)
		if e != nil || track.ID == "" {
			continue
		}
		if i == saved.Index {
			index, retainedCurrent = len(p.state.Queue), true
		}
		id := ""
		if i < len(saved.EntryIDs) {
			id = saved.EntryIDs[i]
		}
		if id == "" || ids[id] {
			id = randomID()
		}
		ids[id] = true
		// Old artwork leases died with the previous core. Mint fresh ones with
		// the plugin's current image credentials; no audio is resolved on startup.
		raw, _ := json.Marshal(track)
		var value any
		_ = json.Unmarshal(raw, &value)
		p.server.images(value, src)
		raw, _ = json.Marshal(value)
		_ = json.Unmarshal(raw, &track)
		p.state.Queue = append(p.state.Queue, track)
		p.state.EntryIDs = append(p.state.EntryIDs, id)
	}
	if len(p.state.Queue) == 0 {
		return
	}
	p.state.Index = index
	p.state.Generation = 1
	p.state.SeekRevision = 1
	p.state.QueueRevision = 1
	p.state.Revision = 1
	p.state.State = "paused"
	p.state.Restored = true
	p.state.PositionAt = time.Now().UnixMilli()
	p.state.Duration = p.state.Queue[index].Duration
	if retainedCurrent {
		if saved.Duration > 0 {
			p.state.Duration = saved.Duration
		}
		p.state.Position = max(0, saved.Position)
		if p.state.Duration > 0 {
			p.state.Position = min(p.state.Position, p.state.Duration)
		}
	}
	for i, id := range saved.History {
		if ids[id] {
			p.history = append(p.history, id)
			if i <= saved.HistoryAt {
				p.historyAt = len(p.history) - 1
			}
		}
	}
	if p.historyAt < 0 || p.historyAt >= len(p.history) || p.history[p.historyAt] != p.state.EntryIDs[index] {
		p.history = []string{p.state.EntryIDs[index]}
		p.historyAt = 0
	}
	valid := func(id string) bool { return !ids[id] }
	p.bag = slices.DeleteFunc(saved.Bag, valid)
	p.nextEntries = slices.DeleteFunc(saved.Next, valid)
	if st := saved.Station; st != nil && st.ID != "" {
		if src, e := p.server.sources.Get(st.Source); e == nil && src.Can("stationNext") {
			p.state.Station = &Station{Source: st.Source, ID: st.ID, Name: st.Name}
		}
	}
}
