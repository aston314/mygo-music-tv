package server

import (
	"encoding/json"
	"errors"
	"slices"

	"mygo-music-tv/core/internal/music"
)

type Station struct {
	Source    string `json:"source"`
	ID        string `json:"id"`
	Name      string `json:"name"`
	Loading   bool   `json:"loading,omitempty"`
	Error     string `json:"error,omitempty"`
	Exhausted bool   `json:"exhausted,omitempty"`
}

func (p *player) endStationLocked() {
	if p.stationAwaiting {
		p.state.State = "ended"
		p.state.WantPlay = false
	}
	p.stationGen++
	p.stationAwaiting = false
	p.state.Station = nil
}

// Only metadata is requested ahead. Resolving or downloading future audio is
// left to beginAtLocked when that entry actually becomes current.
func (p *player) refillStationLocked(retry bool) {
	st := p.state.Station
	if st == nil || p.closed || st.Loading || !retry && (st.Exhausted || st.Error != "" || len(p.state.Queue)-p.state.Index > 3) {
		return
	}
	st.Loading, st.Error, st.Exhausted = true, "", false
	gen, source, id := p.stationGen, st.Source, st.ID
	p.state.Revision++
	p.server.wg.Add(1)
	go func() {
		defer p.server.wg.Done()
		src, err := p.server.sources.Get(source)
		var batch []music.Track
		if err == nil {
			for tries := 0; tries < 3; tries++ {
				var tracks []music.Track
				tracks, err = src.StationNext(id)
				if err != nil || len(tracks) == 0 {
					break
				}
				for _, track := range tracks {
					if track.ID == "" || track.Unavailable {
						continue
					}
					track.Source = source
					batch = append(batch, track)
					if len(batch) == 100 {
						break
					}
				}
				if len(batch) > 0 {
					break
				}
			}
			// Use the same image proxy contract as ordinary plugin pages.
			raw, _ := json.Marshal(batch)
			var value any
			_ = json.Unmarshal(raw, &value)
			p.server.images(value, src)
			raw, _ = json.Marshal(value)
			_ = json.Unmarshal(raw, &batch)
		}
		p.Lock()
		defer p.Unlock()
		if p.closed || gen != p.stationGen || p.state.Station != st {
			return
		}
		st.Loading = false
		p.state.Revision++
		p.state.QueueRevision++
		if err != nil {
			st.Error = "电台暂时无法续播，请重试"
		} else if len(batch) == 0 {
			st.Exhausted = true
		}
		if err != nil || len(batch) == 0 {
			if p.stationAwaiting {
				p.stationAwaiting = false
				p.state.State = "ended"
				p.state.WantPlay = false
			}
			p.saveSessionLocked(true)
			return
		}
		// Keep a bounded queue during long radio sessions, retaining recent
		// history and the identity of the current entry.
		if len(p.state.Queue)+len(batch) > 1000 {
			drop := max(0, p.state.Index-50)
			p.state.Queue = append([]music.Track{}, p.state.Queue[drop:]...)
			p.state.EntryIDs = append([]string{}, p.state.EntryIDs[drop:]...)
			p.state.Index -= drop
			p.trimHistoryLocked()
		}
		batch = batch[:min(len(batch), 1000-len(p.state.Queue))]
		for _, track := range batch {
			p.state.Queue = append(p.state.Queue, track)
			p.state.EntryIDs = append(p.state.EntryIDs, randomID())
		}
		if p.stationAwaiting && p.state.Index+1 < len(p.state.Queue) {
			wantPlay := p.state.WantPlay
			p.rememberLocked(p.state.Index + 1)
			p.beginLocked(p.state.Index + 1)
			p.state.WantPlay = wantPlay
		}
		p.saveSessionLocked(true)
	}()
}

// Radio follows the source's order; the ordinary queue's saved mode is kept.
func (p *player) stationModeError() error {
	if p.state.Station != nil {
		return errors.New("电台按推荐顺序播放，请先退出电台")
	}
	return nil
}

// Clean up a radio's retained history after its old entries leave the queue.
func (p *player) trimHistoryLocked() {
	p.history = slices.DeleteFunc(p.history, func(id string) bool { return !slices.Contains(p.state.EntryIDs, id) })
	p.historyAt = slices.Index(p.history, p.state.EntryIDs[p.state.Index])
}
