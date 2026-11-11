package server

import (
	"errors"
	"net/http"
	"sort"
	"strings"
	"time"

	"mygo-music-tv/core/internal/lyrics"
	"mygo-music-tv/core/internal/music"
)

type LyricPage struct {
	Lines []music.LyricLine `json:"lines"`
	Timed bool              `json:"timed"`
}

// Keep true word timestamps only. Line-level LRC never fabricates karaoke timing.
func normalizeLyrics(raw *music.Lyrics) LyricPage {
	out := LyricPage{Lines: []music.LyricLine{}}
	if raw == nil {
		return out
	}
	if len(raw.Lines) > 0 {
		for _, line := range raw.Lines {
			if line.Text == "" {
				for _, word := range line.Words {
					line.Text += word.Text
				}
			}
			if strings.TrimSpace(line.Text) != "" {
				out.Lines = append(out.Lines, line)
			}
		}
	} else {
		for _, line := range lyrics.Build(raw.LRC, raw.Translation) {
			out.Lines = append(out.Lines, music.LyricLine{Start: int64(line.At / time.Millisecond), End: int64(line.End / time.Millisecond), Text: line.Text, Translation: line.Translation})
		}
	}
	out.Timed = len(out.Lines) > 0
	if out.Timed {
		sort.SliceStable(out.Lines, func(i, j int) bool { return out.Lines[i].Start < out.Lines[j].Start })
		for i := range out.Lines {
			if out.Lines[i].End <= out.Lines[i].Start && i+1 < len(out.Lines) {
				out.Lines[i].End = out.Lines[i+1].Start
			}
		}
	} else {
		for _, text := range strings.Split(raw.LRC, "\n") {
			text = strings.TrimSpace(text)
			if text != "" && !strings.HasPrefix(text, "[") {
				out.Lines = append(out.Lines, music.LyricLine{Text: text})
			}
		}
	}
	return out
}

func (s *Server) getLyrics(w http.ResponseWriter, r *http.Request) {
	p, e := s.sources.Get(r.PathValue("id"))
	if e != nil {
		failure(w, 404, e)
		return
	}
	if !p.Can("lyrics") {
		failure(w, 422, errors.New("此音乐源没有提供歌词"))
		return
	}
	l, e := p.Lyrics(r.URL.Query().Get("id"))
	if e != nil {
		failure(w, 422, e)
		return
	}
	respond(w, normalizeLyrics(l))
}
