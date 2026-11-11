package server

import (
	"encoding/json"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"mygo-music-tv/core/internal/i18n"
)

func preferenceRequest(t *testing.T, s *Server, body string, status int) map[string]string {
	t.Helper()
	method := "GET"
	if body != "" {
		method = "POST"
	}
	r := httptest.NewRequest(method, "/api/preferences", strings.NewReader(body))
	r.Header.Set("Authorization", "Bearer "+s.Token())
	w := httptest.NewRecorder()
	s.ServeHTTP(w, r)
	if w.Code != status {
		t.Fatalf("status %d, want %d: %s", w.Code, status, w.Body.String())
	}
	var prefs map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &prefs); err != nil {
		t.Fatal(err)
	}
	return prefs
}

func TestAppearancePreferencesPersistAndRejectInvalidUpdates(t *testing.T) {
	dir := t.TempDir()
	s, err := New(dir, "fixture", "")
	if err != nil {
		t.Fatal(err)
	}
	defer func() { i18n.SetLanguage(i18n.Chinese) }()
	prefs := preferenceRequest(t, s, "", 200)
	if prefs["theme"] != "dark" || prefs["language"] != "zh-CN" {
		t.Fatal(prefs)
	}
	prefs = preferenceRequest(t, s, `{"theme":"light","language":"zh-TW","sidebar":"icons"}`, 200)
	if prefs["translation"] != "on" || i18n.Language() != i18n.TraditionalChinese {
		t.Fatal(prefs, i18n.Language())
	}
	for _, body := range []string{`{"theme":"system"}`, `{"language":"en"}`, `{"language":"zh-HK"}`, `{"unknown":"x"}`, `{"theme":"dark","language":"invalid"}`} {
		preferenceRequest(t, s, body, 400)
	}
	if preferenceRequest(t, s, "", 200)["theme"] != "light" {
		t.Fatal("invalid batch partially changed preferences")
	}
	s.Close()
	s, err = New(dir, "fixture", "")
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	prefs = preferenceRequest(t, s, "", 200)
	if prefs["theme"] != "light" || prefs["language"] != "zh-TW" || prefs["sidebar"] != "icons" || i18n.Language() != i18n.TraditionalChinese {
		t.Fatal(prefs)
	}
	if err = os.Mkdir(s.settingsPath+".part", 0700); err != nil {
		t.Fatal(err)
	}
	preferenceRequest(t, s, `{"theme":"dark","language":"zh-CN"}`, 500)
	if got := preferenceRequest(t, s, "", 200); got["theme"] != "light" || got["language"] != "zh-TW" || i18n.Language() != i18n.TraditionalChinese {
		t.Fatal("failed save changed active preferences", got)
	}
	b, err := os.ReadFile(s.settingsPath)
	if err != nil || !strings.Contains(string(b), `"theme":"light"`) {
		t.Fatal("failed save replaced disk state", string(b), err)
	}
}

func TestOldOrCorruptPreferencesUseSafeDefaults(t *testing.T) {
	defer func() { i18n.SetLanguage(i18n.Chinese) }()
	for _, body := range []string{`{"sidebar":"icons","translation":"off"}`, `{"theme":"invalid","language":"en","obsolete":"x"}`, `null`, `{"theme":"light",broken}`} {
		t.Run(body, func(t *testing.T) {
			dir := t.TempDir()
			if err := os.WriteFile(filepath.Join(dir, "preferences.json"), []byte(body), 0600); err != nil {
				t.Fatal(err)
			}
			s, err := New(dir, "fixture", "")
			if err != nil {
				t.Fatal(err)
			}
			defer s.Close()
			prefs := preferenceRequest(t, s, "", 200)
			if prefs["theme"] != "dark" || prefs["language"] != "zh-CN" || len(prefs) != 4 {
				t.Fatal(prefs)
			}
			if strings.Contains(body, `"icons"`) && prefs["sidebar"] != "icons" {
				t.Fatal("lost old preference")
			}
		})
	}
}
