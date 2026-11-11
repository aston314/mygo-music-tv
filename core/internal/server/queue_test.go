package server

import (
	"path/filepath"
	"testing"

	"mygo-music-tv/core/internal/music"
)

func fixtureQueue() []music.Track {
	return []music.Track{{ID: "t1", Source: "fixture", Name: "one"}, {ID: "t2", Source: "fixture", Name: "two"}, {ID: "t3", Source: "fixture", Name: "three"}}
}

func TestQueueRepeatModes(t *testing.T) {
	for _, mode := range []string{"sequence", "loop", "single", "shuffle"} {
		t.Run(mode, func(t *testing.T) {
			s := newTest(t)
			p := s.player
			if err := p.setMode(mode); err != nil {
				t.Fatal(err)
			}
			if err := p.play(fixtureQueue(), 2); err != nil {
				t.Fatal(err)
			}
			before := p.snapshot()
			if !p.event(before.Generation, "ended", 1000, 1000) {
				t.Fatal("end rejected")
			}
			after := p.snapshot()
			switch mode {
			case "sequence":
				if after.Generation != before.Generation || after.State != "ended" {
					t.Fatalf("sequence did not stop: %+v", after)
				}
			case "loop":
				if after.Index != 0 || after.Generation != before.Generation+1 {
					t.Fatalf("loop did not wrap: %+v", after)
				}
			case "single":
				if after.Index != 2 || after.Generation != before.Generation+1 {
					t.Fatalf("single did not repeat: %+v", after)
				}
			case "shuffle":
				if after.Index == 2 {
					t.Fatal("shuffle immediately repeated")
				}
			}
			if p.event(before.Generation, "ended", 1000, 1000) {
				t.Fatal("duplicate end accepted")
			}
		})
	}
}

func TestShuffleHistoryAndPriority(t *testing.T) {
	s := newTest(t)
	p := s.player
	_ = p.setMode("shuffle")
	_ = p.play(fixtureQueue(), 0)
	_ = p.control("next", 0)
	second := p.snapshot()
	_ = p.control("next", 0)
	third := p.snapshot()
	if second.Index == 0 || third.Index == 0 || second.Index == third.Index {
		t.Fatal("shuffle repeated within a cycle")
	}
	_ = p.control("previous", 0)
	if p.snapshot().EntryIDs[p.snapshot().Index] != second.EntryIDs[second.Index] {
		t.Fatal("previous did not follow real history")
	}
	_ = p.control("next", 0)
	if p.snapshot().Index != third.Index {
		t.Fatal("forward history lost")
	}
	track := music.Track{ID: "t1", Source: "fixture", Name: "priority"}
	if err := p.changeQueue(QueueChange{Action: "next", Tracks: []music.Track{track}}); err != nil {
		t.Fatal(err)
	}
	_ = p.control("next", 0)
	if got := p.snapshot(); got.Queue[got.Index].Name != "priority" {
		t.Fatal("play next ignored in shuffle mode")
	}
}

func TestQueueEditsPreserveCurrentMediaAndDuplicateIdentity(t *testing.T) {
	s := newTest(t)
	p := s.player
	_ = p.play(fixtureQueue(), 1)
	before := waitPlayback(t, s, func(p Playback) bool { return p.Media != "" })
	if err := p.changeQueue(QueueChange{Action: "append", Tracks: []music.Track{fixtureQueue()[1]}}); err != nil {
		t.Fatal(err)
	}
	after := p.snapshot()
	if after.Generation != before.Generation || after.Media != before.Media {
		t.Fatal("append restarted audio")
	}
	if after.Revision <= before.Revision || after.QueueRevision <= before.QueueRevision {
		t.Fatal("append did not supersede older playback snapshots")
	}
	if after.EntryIDs[1] == after.EntryIDs[3] {
		t.Fatal("duplicate song has no distinct identity")
	}
	if err := p.changeQueue(QueueChange{Action: "remove", EntryID: after.EntryIDs[0]}); err != nil {
		t.Fatal(err)
	}
	after = p.snapshot()
	if after.Index != 0 || after.EntryIDs[0] != before.EntryIDs[1] || after.Media != before.Media {
		t.Fatal("remove before current changed playback")
	}
	if err := p.changeQueue(QueueChange{Action: "remove", EntryID: after.EntryIDs[0]}); err != nil {
		t.Fatal(err)
	}
	if got := p.snapshot(); got.Generation != before.Generation+1 || got.Queue[got.Index].ID != "t3" {
		t.Fatal("remove current did not advance")
	}
	if err := p.changeQueue(QueueChange{Action: "clear"}); err != nil {
		t.Fatal(err)
	}
	if got := p.snapshot(); len(got.Queue) != 0 || got.State != "idle" || got.Media != "" {
		t.Fatal("clear left a playback session")
	}
	_ = p.changeQueue(QueueChange{Action: "append", Tracks: []music.Track{fixtureQueue()[0]}})
	id := p.snapshot().EntryIDs[0]
	if err := p.changeQueue(QueueChange{Action: "remove", EntryID: id}); err != nil || len(p.snapshot().Queue) != 0 {
		t.Fatal("remove last did not clear", err)
	}
}

func TestModePersistsIndependentOfSessionAndInvalidModeIsRejected(t *testing.T) {
	s := newTest(t)
	path := filepath.Join(t.TempDir(), "player-settings.json")
	p := newPlayer(s, path)
	if err := p.setMode("loop"); err != nil {
		t.Fatal(err)
	}
	if err := p.setMode("invalid"); err == nil {
		t.Fatal("invalid mode accepted")
	}
	if p := newPlayer(s, path); p.snapshot().Mode != "loop" {
		t.Fatal("mode was not restored")
	}
}

func TestSeekIgnoresEventsFromBeforeTheRequestedPosition(t *testing.T) {
	s := newTest(t)
	p := s.player
	_ = p.play(fixtureQueue(), 0)
	before := waitPlayback(t, s, func(p Playback) bool { return p.Media != "" })
	if err := p.control("seek", 1800); err != nil {
		t.Fatal(err)
	}
	if p.event(before.Generation, "ended", 12000, 12000, before.SeekRevision) {
		t.Fatal("pre-seek end advanced the queue")
	}
	after := p.snapshot()
	if after.Position != 1800 || after.Index != 0 {
		t.Fatal("pre-seek event replaced the requested position")
	}
	if !p.event(after.Generation, "playing", 1900, 12000, after.SeekRevision) || p.snapshot().Position != 1900 {
		t.Fatal("confirmed seek acknowledgement was rejected")
	}
}
