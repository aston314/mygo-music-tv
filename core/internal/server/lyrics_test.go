package server

import (
	"mygo-music-tv/core/internal/music"
	"testing"
)

func TestLyricsNormalizeTranslationWithoutInventingWordTiming(t *testing.T) {
	l := normalizeLyrics(&music.Lyrics{LRC: "[00:01.00][00:03.00]same line\n[00:05.00]last", Translation: "[00:01.00]翻译"})
	if !l.Timed || len(l.Lines) != 3 || l.Lines[0].Translation != "翻译" || l.Lines[1].Start != 3000 {
		t.Fatalf("%+v", l)
	}
	if len(l.Lines[0].Words) != 0 {
		t.Fatal("LRC fabricated karaoke timestamps")
	}
	r := normalizeLyrics(&music.Lyrics{Lines: []music.LyricLine{{Start: 5000, Words: []music.LyricWord{{Start: 5000, End: 6000, Text: "word"}}}}})
	if r.Lines[0].Text != "word" || r.Lines[0].Words[0].End != 6000 {
		t.Fatal("real word timestamps lost")
	}
	u := normalizeLyrics(&music.Lyrics{LRC: "plain\nlyrics"})
	if u.Timed || len(u.Lines) != 2 {
		t.Fatal("plain lyrics treated as timed")
	}
}
