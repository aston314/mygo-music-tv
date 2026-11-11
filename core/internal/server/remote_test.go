package server

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"mygo-music-tv/core/internal/music"
)

func remoteTestServer(t *testing.T) *Server {
	t.Helper()
	s, err := New(t.TempDir(), "real", "test-remote-token-01234567890123456789")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(s.Close)
	dir := t.TempDir()
	for name, body := range map[string]string{
		"plugin.json": `{"id":"remote","name":"Remote fixture","playback":"remote"}`,
		"index.js": `let state = null;
export async function remotePlay({ids,start,position}) {
  if (ids[start] === 'slow') await new Promise(r => setTimeout(r, 150));
  state = {playing:true,trackId:ids[start],position,duration:10000,device:'fixture-device'};
}
export function remotePause(){ if(state) state.playing=false; }
export function remoteResume(){ if(state) state.playing=true; }
export function remoteSeek({position}){ if(state) state.position=position; }
export function remoteState(){ return state; }`,
	} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(body), 0600); err != nil {
			t.Fatal(err)
		}
	}
	if err := s.sources.AddFixture(dir); err != nil {
		t.Fatal(err)
	}
	return s
}

func waitPlayback(t *testing.T, s *Server, check func(Playback) bool) Playback {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		p := s.player.snapshot()
		if check(p) {
			return p
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatalf("playback condition not reached: %+v", s.player.snapshot())
	return Playback{}
}

// A remote plugin reports actual device state; controls never create a local media URL.
func TestRemotePlaybackControls(t *testing.T) {
	s := remoteTestServer(t)
	if err := s.player.play([]music.Track{{ID: "one", Source: "fixture"}}, 0); err != nil {
		t.Fatal(err)
	}
	p := waitPlayback(t, s, func(p Playback) bool { return p.State == "playing" })
	if !p.Remote || p.Device != "fixture-device" || p.Media != "" {
		t.Fatalf("remote device treated as local audio: %+v", p)
	}
	src, _ := s.sources.Get("fixture")
	for _, action := range []string{"pause", "seek", "resume", "stop"} {
		if err := s.player.control(action, 500); err != nil {
			t.Fatal(err)
		}
		r, err := src.RemoteState()
		if err != nil || r == nil {
			t.Fatalf("device state: %+v %v", r, err)
		}
		if action == "seek" && r.Position != 500 || action == "resume" && !r.Playing || (action == "pause" || action == "stop") && r.Playing {
			t.Fatalf("%s was not sent to device: %+v", action, r)
		}
	}
	if p := s.player.snapshot(); p.Remote || p.State != "idle" {
		t.Fatalf("stop retained remote session: %+v", p)
	}
}

// A plugin call already in flight cannot restart an old track after a switch or stop.
func TestLateRemotePlayIsPaused(t *testing.T) {
	s := remoteTestServer(t)
	q := []music.Track{{ID: "slow", Source: "fixture"}, {ID: "new", Source: "fixture"}}
	if err := s.player.play(q, 0); err != nil {
		t.Fatal(err)
	}
	waitPlayback(t, s, func(p Playback) bool { return p.Remote })
	if err := s.player.play(q, 1); err != nil {
		t.Fatal(err)
	}
	waitPlayback(t, s, func(p Playback) bool { return p.State == "playing" && p.Index == 1 })
	src, _ := s.sources.Get("fixture")
	r, err := src.RemoteState()
	if err != nil || r == nil || r.TrackID != "new" {
		t.Fatalf("old remote play won: %+v %v", r, err)
	}
	if err := s.player.control("stop", 0); err != nil {
		t.Fatal(err)
	}
	r, err = src.RemoteState()
	if err != nil || r.Playing {
		t.Fatalf("remote still playing after stop: %+v %v", r, err)
	}
}
