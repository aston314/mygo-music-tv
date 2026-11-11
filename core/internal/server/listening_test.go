package server

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"mygo-music-tv/core/internal/music"
)

func TestSessionRestoresPausedWithoutResolvingAudio(t *testing.T) {
	dir := t.TempDir()
	s, err := New(dir, "fixture", "")
	if err != nil {
		t.Fatal(err)
	}
	p := s.player
	q := fixtureQueue()
	q = append(q, q[0]) // Duplicate songs must remain independent entries.
	q[2].Album.ImageURL = s.media.add("https://example.com/cover.jpg", map[string]string{"Cookie": "private"}, time.Hour, false)
	if err = p.play(q, 2); err != nil {
		t.Fatal(err)
	}
	before := waitPlayback(t, s, func(p Playback) bool { return p.State == "ready" })
	p.event(before.Generation, "playing", 3456, 12000)
	if err = p.control("pause", 0); err != nil {
		t.Fatal(err)
	}
	if err = p.changeQueue(QueueChange{Action: "next", Tracks: []music.Track{q[0]}}); err != nil {
		t.Fatal(err)
	}
	s.Close()
	b, _ := os.ReadFile(filepath.Join(dir, "playback-session.json"))
	if strings.Contains(string(b), "/media/") || strings.Contains(string(b), "private") {
		t.Fatal("persisted leases or credentials")
	}
	s, err = New(dir, "fixture", "")
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	after := s.player.snapshot()
	if after.State != "paused" || after.WantPlay || after.Media != "" || !after.Restored || after.Position != 3456 || after.Index != 2 || len(after.Queue) != 5 {
		t.Fatalf("restore: %+v", after)
	}
	if after.EntryIDs[0] != before.EntryIDs[0] || after.EntryIDs[0] == after.EntryIDs[4] {
		t.Fatal("entry identity was lost")
	}
	cover := after.Queue[2].Album.ImageURL
	if !strings.HasPrefix(cover, "/media/") {
		t.Fatal("artwork not reproxied", cover)
	}
	if err = s.player.control("resume", 0); err != nil {
		t.Fatal(err)
	}
	after = waitPlayback(t, s, func(p Playback) bool { return p.State == "ready" })
	if !after.WantPlay || after.Position != 3456 || after.Media == "" {
		t.Fatalf("resume lost position: %+v", after)
	}
	if err = s.player.changeQueue(QueueChange{Action: "clear"}); err != nil {
		t.Fatal(err)
	}
	s.Close()
	s, err = New(dir, "fixture", "")
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if len(s.player.snapshot().Queue) != 0 {
		t.Fatal("cleared queue reappeared")
	}
}

func TestSessionRecoversFromMissingSourcesAndFailedAtomicSave(t *testing.T) {
	dir := t.TempDir()
	saved := playbackSession{Version: 1, Queue: []music.Track{{ID: "gone", Source: "removed"}, {ID: "t1", Source: "fixture", Duration: 12000}}, EntryIDs: []string{"gone", "kept"}, Index: 0, Position: 9000}
	b, _ := json.Marshal(saved)
	path := filepath.Join(dir, "playback-session.json")
	_ = os.WriteFile(path, b, 0600)
	s, err := New(dir, "fixture", "")
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	p := s.player.snapshot()
	if len(p.Queue) != 1 || p.Queue[0].ID != "t1" || p.Position != 0 || p.WantPlay {
		t.Fatal(p)
	}
	if err = os.Mkdir(path+".part", 0700); err != nil {
		t.Fatal(err)
	}
	if err = s.player.control("seek", 2000); err != nil {
		t.Fatal(err)
	}
	if s.player.snapshot().PersistenceError == "" {
		t.Fatal("storage failure hidden")
	}
	old, _ := os.ReadFile(path)
	if string(old) != string(b) {
		t.Fatal("failed save destroyed prior session")
	}
	for _, body := range []string{`null`, `{"version":1,"queue":[{"source":"fixture","id":"t1"}],"index":-1}`, `broken`} {
		_ = os.WriteFile(path, []byte(body), 0600)
		p := newPlayer(s, filepath.Join(dir, "unused-settings"))
		p.restoreSession(path)
		if len(p.snapshot().Queue) != 0 {
			t.Fatal("invalid session accepted")
		}
	}
}

func TestQualityPreferenceAppliesOnNextResolve(t *testing.T) {
	s := newTest(t)
	preferenceRequest(t, s, `{"quality":"standard","source":"fixture"}`, 200)
	if err := s.player.play(fixtureQueue(), 0); err != nil {
		t.Fatal(err)
	}
	p := waitPlayback(t, s, func(p Playback) bool { return p.State == "ready" })
	if p.Quality != "standard" {
		t.Fatal(p.Quality)
	}
	preferenceRequest(t, s, `{"quality":"lossless"}`, 200)
	preferenceRequest(t, s, `{"quality":"ultra"}`, 400)
	if after := s.player.snapshot(); after.Generation != p.Generation || after.Media != p.Media || after.Quality != "standard" {
		t.Fatal("preference interrupted playback")
	}
	if err := s.player.control("retry", 0); err != nil {
		t.Fatal(err)
	}
	p = waitPlayback(t, s, func(p Playback) bool { return p.State == "ready" })
	if p.Quality != "lossless" {
		t.Fatal(p.Quality)
	}
}

func TestPlaybackPreferencesSurviveRestart(t *testing.T) {
	dir := t.TempDir()
	s, err := New(dir, "fixture", "")
	if err != nil {
		t.Fatal(err)
	}
	preferenceRequest(t, s, `{"quality":"lossless","source":"fixture"}`, 200)
	s.Close()
	s, err = New(dir, "fixture", "")
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	got := preferenceRequest(t, s, "", 200)
	if got["quality"] != "lossless" || got["source"] != "fixture" {
		t.Fatal(got)
	}
}

func stationFixture(t *testing.T, body string) *Server {
	t.Helper()
	s := newTest(t)
	dir := t.TempDir()
	_ = os.WriteFile(filepath.Join(dir, "plugin.json"), []byte(`{"id":"radio","name":"Radio","playback":"stream"}`), 0600)
	_ = os.WriteFile(filepath.Join(dir, "index.js"), []byte(body+`
export function stream({quality}) {return {url:'https://example.com/audio.mp3',quality};}`), 0600)
	if err := s.sources.AddFixture(dir); err != nil {
		t.Fatal(err)
	}
	return s
}

func TestStationRefillsMetadataAndDropsLateBatches(t *testing.T) {
	s := stationFixture(t, `let n=0; export async function stationNext(){await new Promise(r=>setTimeout(r,80));return [{id:'radio-'+(++n),name:'Next'}];}`)
	p := s.player
	if err := p.playWithStation(fixtureQueue()[:1], 0, &Station{Source: "fixture", ID: "st", Name: "Radio"}); err != nil {
		t.Fatal(err)
	}
	before := p.snapshot()
	if !p.event(before.Generation, "ended", 12000, 12000) {
		t.Fatal("end rejected")
	}
	if p.event(before.Generation, "ended", 12000, 12000) {
		t.Fatal("duplicate end accepted")
	}
	after := waitPlayback(t, s, func(p Playback) bool { return p.Index == 1 && p.State == "ready" })
	if after.Queue[1].Source != "fixture" || after.Queue[1].ID != "radio-1" || !after.WantPlay {
		t.Fatal(after)
	}
	if err := p.play(fixtureQueue(), 2); err != nil {
		t.Fatal(err)
	}
	_ = waitPlayback(t, s, func(p Playback) bool { return p.State == "ready" && p.Index == 2 })
	time.Sleep(150 * time.Millisecond)
	after = p.snapshot()
	if after.Station != nil || len(after.Queue) != 3 || after.Index != 2 {
		t.Fatal("old radio batch overwrote replacement", after)
	}
}

func TestStationFailureRetryAndPauseWhileWaiting(t *testing.T) {
	s := stationFixture(t, `let n=0; export async function stationNext(){await new Promise(r=>setTimeout(r,60));if(++n===1)throw Error('offline');return [{id:'new',name:'new'}];}`)
	p := s.player
	_ = p.playWithStation(fixtureQueue()[:1], 0, &Station{Source: "fixture", ID: "st"})
	before := p.snapshot()
	p.event(before.Generation, "ended", 12000, 12000)
	_ = waitPlayback(t, s, func(p Playback) bool { return p.Station != nil && p.Station.Error != "" })
	if err := p.control("station-retry", 0); err != nil {
		t.Fatal(err)
	}
	if err := p.control("pause", 0); err != nil {
		t.Fatal(err)
	}
	after := waitPlayback(t, s, func(p Playback) bool { return p.Index == 1 && p.State == "ready" })
	if after.WantPlay || after.Station.Error != "" {
		t.Fatal("refill restarted paused audio", after)
	}
	if err := p.setMode("shuffle"); err == nil {
		t.Fatal("radio accepted shuffle")
	}
	if err := p.control("leave-station", 0); err != nil {
		t.Fatal(err)
	}
	if p.snapshot().Media != after.Media || p.snapshot().Station != nil {
		t.Fatal("leaving radio restarted song")
	}
}

func TestStationBoundsQueueWithoutReplacingCurrentAudio(t *testing.T) {
	s := stationFixture(t, `export function stationNext(){return [{id:'new',name:'New'}];}`)
	queue := make([]music.Track, 1000)
	for i := range queue {
		queue[i] = music.Track{ID: fmt.Sprint(i), Source: "fixture", Name: "Song"}
	}
	if err := s.player.playWithStation(queue, 998, &Station{Source: "fixture", ID: "st"}); err != nil {
		t.Fatal(err)
	}
	before := s.player.snapshot()
	after := waitPlayback(t, s, func(p Playback) bool { return p.State == "ready" && p.Station != nil && !p.Station.Loading })
	if len(after.Queue) != 53 || after.Index != 50 || after.EntryIDs[after.Index] != before.EntryIDs[998] || after.Generation != before.Generation || after.Queue[52].Source != "fixture" {
		t.Fatal(after)
	}
	if err := s.player.control("previous", 0); err != nil {
		t.Fatal(err)
	}
	if s.player.snapshot().Queue[s.player.snapshot().Index].ID != "997" {
		t.Fatal("recent radio history lost")
	}
}
