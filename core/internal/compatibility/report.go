// Package compatibility records bounded, read-only plugin checks separately
// from account authorization and real device playback.
package compatibility

import (
	"embed"
	"encoding/json"
)

//go:embed report.json
var files embed.FS

type Stage struct {
	State string `json:"state"`
	Count int    `json:"count,omitempty"`
	Code  string `json:"code,omitempty"`
}
type Entry struct {
	Repository   string           `json:"repository"`
	Revision     string           `json:"revision,omitempty"`
	Version      string           `json:"version,omitempty"`
	Name         string           `json:"name,omitempty"`
	Playback     string           `json:"playback,omitempty"`
	Process      []string         `json:"process,omitempty"`
	Login        []string         `json:"login,omitempty"`
	Capabilities []string         `json:"capabilities,omitempty"`
	Stages       map[string]Stage `json:"stages"`
}
type Report struct {
	ObservedAt string  `json:"observedAt"`
	Directory  string  `json:"directory"`
	Host       string  `json:"host"`
	Entries    []Entry `json:"entries"`
}

func Bundled() Report {
	var r Report
	b, _ := files.ReadFile("report.json")
	_ = json.Unmarshal(b, &r)
	return r
}
