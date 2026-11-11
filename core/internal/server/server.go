package server

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io/fs"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	product "mygo-music-tv"
	"mygo-music-tv/core/examples"
	"mygo-music-tv/core/internal/catalog"
	"mygo-music-tv/core/internal/i18n"
	"mygo-music-tv/core/internal/music"
	"mygo-music-tv/core/internal/plugin"
	"mygo-music-tv/core/internal/sources"
	"mygo-music-tv/ui"
	"rsc.io/qr"
)

func randomID() string {
	b := make([]byte, 24)
	if _, e := rand.Read(b); e != nil {
		panic(e)
	}
	return hex.EncodeToString(b)
}

type Login struct {
	ID      string             `json:"id"`
	Source  string             `json:"source"`
	State   string             `json:"state"`
	Prompt  music.SignInPrompt `json:"prompt"`
	Message string             `json:"message,omitempty"`
}
type Server struct {
	sources                 *sources.Manager
	catalog                 *catalog.Catalog
	media                   *media
	player                  *player
	mode, token, fixtureDir string
	mux                     *http.ServeMux
	mu                      sync.Mutex
	login                   Login
	wg                      sync.WaitGroup
	settingsPath            string
	settings                map[string]string
}

func New(data, mode, token string) (*Server, error) {
	abs, err := filepath.Abs(data)
	if err != nil {
		return nil, err
	}
	data = abs
	if token == "" {
		token = randomID()
	}
	cfg := product.App()
	plugin.SetAppVersion(cfg.PluginCompatibilityVersion)
	plugin.PublicRepositoriesOnly()
	settingsPath := filepath.Join(data, "preferences.json")
	settings := defaultPreferences()
	if b, e := os.ReadFile(settingsPath); e == nil {
		var saved map[string]string
		if json.Unmarshal(b, &saved) == nil {
			for k, v := range saved {
				if validPreference(k, v) {
					settings[k] = v
				}
			}
		}
	}
	i18n.SetLanguage(settings["language"])
	m, e := sources.New(filepath.Join(data, "instances"))
	if e != nil {
		return nil, e
	}
	s := &Server{sources: m, catalog: catalog.New(cfg.PluginCatalogURL, filepath.Join(data, "catalog.json")), media: newMedia(), mode: mode, token: token, mux: http.NewServeMux(), settingsPath: settingsPath, settings: settings}
	if mode != "real" {
		s.fixtureDir = filepath.Join(data, "fixture")
		if e = s.extractFixture(); e != nil {
			return nil, e
		}
		if e = m.AddFixture(s.fixtureDir); e != nil {
			return nil, e
		}
	}
	s.player = newPlayer(s, filepath.Join(data, "player-settings.json"))
	s.player.restoreSession(filepath.Join(data, "playback-session.json"))
	m.GuardUpdate = s.player.guardPluginUpdate
	if mode == "real" {
		m.StartUpdateChecks()
	}
	s.routes()
	return s, nil
}
func defaultPreferences() map[string]string {
	return map[string]string{"sidebar": "expanded", "translation": "on", "theme": "light", "language": "zh-CN", "quality": "high", "source": ""}
}
func validPreference(key, value string) bool {
	switch key {
	case "sidebar":
		return value == "expanded" || value == "icons"
	case "translation":
		return value == "on" || value == "off"
	case "theme":
		return value == "dark" || value == "light"
	case "language":
		return value == "zh-CN" || value == "zh-TW"
	case "quality":
		return value == "standard" || value == "high" || value == "lossless"
	case "source":
		if value == "" || value == "fixture" {
			return true
		}
		_, err := hex.DecodeString(value)
		return len(value) == 24 && err == nil
	}
	return false
}
func (s *Server) extractFixture() error {
	return fs.WalkDir(examples.Files, "demo-plugin", func(path string, d fs.DirEntry, e error) error {
		if e != nil {
			return e
		}
		to := filepath.Join(s.fixtureDir, strings.TrimPrefix(path, "demo-plugin/"))
		if path == "demo-plugin" {
			to = s.fixtureDir
		}
		if d.IsDir() {
			return os.MkdirAll(to, 0700)
		}
		b, e := examples.Files.ReadFile(path)
		if e != nil {
			return e
		}
		return os.WriteFile(to, b, 0600)
	})
}
func (s *Server) Token() string { return s.token }
func (s *Server) Close()        { s.player.close(); s.sources.Close(); s.wg.Wait(); s.media.close() }
func (s *Server) authorized(r *http.Request) bool {
	t := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	if c, e := r.Cookie("mygo_session"); e == nil && t == "" {
		t = c.Value
	}
	return subtle.ConstantTimeCompare([]byte(t), []byte(s.token)) == 1
}
func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Referrer-Policy", "no-referrer")
	w.Header().Set("Cache-Control", "no-store")
	if r.URL.Path == "/" && r.URL.Query().Get("token") != "" {
		if subtle.ConstantTimeCompare([]byte(r.URL.Query().Get("token")), []byte(s.token)) != 1 {
			http.Error(w, "Unauthorized", 401)
			return
		}
		http.SetCookie(w, &http.Cookie{Name: "mygo_session", Value: s.token, Path: "/", HttpOnly: true, SameSite: http.SameSiteStrictMode})
		http.Redirect(w, r, "/", 303)
		return
	}
	if strings.HasPrefix(r.URL.Path, "/api/") || r.URL.Path == "/health" {
		if !s.authorized(r) {
			http.Error(w, "Unauthorized", 401)
			return
		}
		if origin := r.Header.Get("Origin"); origin != "" && origin != "http://"+r.Host {
			http.Error(w, "Forbidden", 403)
			return
		}
	}
	if r.URL.Path == "/" {
		w.Header().Set("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; media-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'; frame-ancestors 'none'")
	}
	s.mux.ServeHTTP(w, r)
}
func respond(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(v)
}
func failure(w http.ResponseWriter, status int, e error) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	code := "error"
	for _, v := range []struct {
		e error
		c string
	}{{music.ErrSignIn, "signIn"}, {music.ErrSetup, "setup"}, {music.ErrUnsupported, "unsupported"}, {music.ErrUnavailable, "unavailable"}} {
		if errors.Is(e, v.e) {
			code = v.c
		}
	}
	respond(w, map[string]string{"error": e.Error(), "code": code})
}
func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	if e := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(v); e != nil {
		failure(w, 400, errors.New("请求内容无效"))
		return false
	}
	return true
}
func (s *Server) routes() {
	s.mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		respond(w, map[string]any{"ready": true, "version": product.App().VersionName, "instance": s.token[:12], "mode": s.mode, "capabilities": map[string]bool{"plugins": true, "localMusic": false, "process": false, "webSignIn": false}})
	})
	s.mux.HandleFunc("GET /api/config", func(w http.ResponseWriter, r *http.Request) {
		respond(w, map[string]any{"app": product.App(), "mode": s.mode})
	})
	s.mux.HandleFunc("GET /api/catalog", s.getCatalog)
	s.mux.HandleFunc("GET /api/sources", func(w http.ResponseWriter, r *http.Request) { respond(w, s.sources.List()) })
	s.mux.HandleFunc("POST /api/plugins/install", func(w http.ResponseWriter, r *http.Request) {
		var q struct {
			Repository string `json:"repository"`
		}
		if !decode(w, r, &q) {
			return
		}
		j, e := s.sources.Start(q.Repository)
		if e != nil {
			failure(w, 400, e)
			return
		}
		respond(w, j)
	})
	s.mux.HandleFunc("GET /api/plugins/updates", func(w http.ResponseWriter, r *http.Request) { respond(w, s.sources.Updates()) })
	s.mux.HandleFunc("POST /api/plugins/check-updates", func(w http.ResponseWriter, r *http.Request) {
		var q struct {
			InstanceID string `json:"instanceId"`
		}
		if !decode(w, r, &q) {
			return
		}
		if e := s.sources.CheckUpdates(q.InstanceID, true); e != nil {
			failure(w, 400, e)
			return
		}
		respond(w, s.sources.Updates())
	})
	s.mux.HandleFunc("POST /api/plugins/update", func(w http.ResponseWriter, r *http.Request) {
		var q struct {
			InstanceID string `json:"instanceId"`
			Version    string `json:"version"`
		}
		if !decode(w, r, &q) {
			return
		}
		j, e := s.sources.StartUpdate(q.InstanceID, q.Version)
		if e != nil {
			failure(w, 400, e)
			return
		}
		respond(w, j)
	})
	s.mux.HandleFunc("POST /api/jobs/{id}/confirm", func(w http.ResponseWriter, r *http.Request) {
		var q struct {
			Allow bool `json:"allow"`
		}
		if !decode(w, r, &q) {
			return
		}
		j, e := s.sources.ConfirmUpdate(r.PathValue("id"), q.Allow)
		if e != nil {
			failure(w, 400, e)
			return
		}
		respond(w, j)
	})
	s.mux.HandleFunc("GET /api/jobs/{id}", func(w http.ResponseWriter, r *http.Request) {
		j, ok := s.sources.Job(r.PathValue("id"))
		if !ok {
			http.NotFound(w, r)
			return
		}
		respond(w, j)
	})
	s.mux.HandleFunc("DELETE /api/sources/{id}", func(w http.ResponseWriter, r *http.Request) {
		if e := s.sources.Remove(r.PathValue("id")); e != nil {
			failure(w, 400, e)
			return
		}
		respond(w, map[string]bool{"ok": true})
	})
	s.mux.HandleFunc("POST /api/sources/{id}/call/{method}", s.call)
	s.mux.HandleFunc("POST /api/sources/{id}/settings", func(w http.ResponseWriter, r *http.Request) {
		var q struct{ Key, Value string }
		if !decode(w, r, &q) {
			return
		}
		p, e := s.sources.Get(r.PathValue("id"))
		if e == nil {
			valid := false
			for _, setting := range p.Info().Settings {
				if setting.Key == q.Key {
					valid = true
				}
			}
			if !valid {
				e = errors.New("未知设置")
			} else {
				e = p.SetSetting(q.Key, q.Value)
			}
		}
		if e != nil {
			failure(w, 400, e)
			return
		}
		respond(w, map[string]bool{"ok": true})
	})
	s.mux.HandleFunc("POST /api/login/{id}", s.startLogin)
	s.mux.HandleFunc("GET /api/login", func(w http.ResponseWriter, r *http.Request) { s.mu.Lock(); defer s.mu.Unlock(); respond(w, s.login) })
	s.mux.HandleFunc("DELETE /api/login", func(w http.ResponseWriter, r *http.Request) {
		s.mu.Lock()
		id := s.login.Source
		s.login.ID = randomID()
		s.login.State = "cancelled"
		s.mu.Unlock()
		if p, e := s.sources.Get(id); e == nil {
			p.Close()
		}
		respond(w, map[string]bool{"ok": true})
	})
	s.mux.HandleFunc("GET /api/login/qr", func(w http.ResponseWriter, r *http.Request) {
		s.mu.Lock()
		value := s.login.Prompt.QR
		s.mu.Unlock()
		if value == "" || len(value) > 4000 {
			http.NotFound(w, r)
			return
		}
		code, e := qr.Encode(value, qr.M)
		if e != nil {
			w.WriteHeader(422)
			return
		}
		w.Header().Set("Content-Type", "image/png")
		_, _ = w.Write(code.PNG())
	})
	s.mux.HandleFunc("GET /api/player", func(w http.ResponseWriter, r *http.Request) { respond(w, s.player.snapshot()) })
	s.mux.HandleFunc("POST /api/player/mode", func(w http.ResponseWriter, r *http.Request) {
		var q struct{ Mode string }
		if !decode(w, r, &q) {
			return
		}
		if e := s.player.setMode(q.Mode); e != nil {
			failure(w, 400, e)
			return
		}
		respond(w, s.player.snapshot())
	})
	s.mux.HandleFunc("POST /api/player/queue", func(w http.ResponseWriter, r *http.Request) {
		var q QueueChange
		if !decode(w, r, &q) {
			return
		}
		if e := s.player.changeQueue(q); e != nil {
			failure(w, 400, e)
			return
		}
		respond(w, s.player.snapshot())
	})
	s.mux.HandleFunc("GET /api/sources/{id}/lyrics", s.getLyrics)
	s.mux.HandleFunc("POST /api/player/play", func(w http.ResponseWriter, r *http.Request) {
		var q struct {
			Queue   []music.Track `json:"queue"`
			Index   int           `json:"index"`
			Station *Station      `json:"station"`
		}
		if !decode(w, r, &q) {
			return
		}
		if e := s.player.playWithStation(q.Queue, q.Index, q.Station); e != nil {
			failure(w, 400, e)
			return
		}
		respond(w, s.player.snapshot())
	})
	s.mux.HandleFunc("POST /api/player/control", func(w http.ResponseWriter, r *http.Request) {
		var q struct {
			Action   string
			Position int64
		}
		if !decode(w, r, &q) {
			return
		}
		if e := s.player.control(q.Action, q.Position); e != nil {
			failure(w, 400, e)
			return
		}
		respond(w, s.player.snapshot())
	})
	s.mux.HandleFunc("POST /api/player/event", func(w http.ResponseWriter, r *http.Request) {
		var q struct {
			Generation         int64
			SeekRevision       int64
			State              string
			Position, Duration int64
		}
		if !decode(w, r, &q) {
			return
		}
		respond(w, map[string]bool{"accepted": s.player.event(q.Generation, q.State, q.Position, q.Duration, q.SeekRevision)})
	})
	s.mux.HandleFunc("GET /api/preferences", func(w http.ResponseWriter, r *http.Request) { s.mu.Lock(); defer s.mu.Unlock(); respond(w, s.settings) })
	s.mux.HandleFunc("POST /api/preferences", func(w http.ResponseWriter, r *http.Request) {
		var q map[string]string
		if !decode(w, r, &q) {
			return
		}
		for k, v := range q {
			if !validPreference(k, v) {
				failure(w, 400, errors.New("无效偏好设置"))
				return
			}
		}
		s.mu.Lock()
		defer s.mu.Unlock()
		next := map[string]string{}
		for k, v := range s.settings {
			next[k] = v
		}
		for k, v := range q {
			next[k] = v
		}
		b, _ := json.Marshal(next)
		if e := os.WriteFile(s.settingsPath+".part", b, 0600); e != nil {
			failure(w, 500, e)
			return
		}
		if e := os.Rename(s.settingsPath+".part", s.settingsPath); e != nil {
			failure(w, 500, e)
			return
		}
		s.settings = next
		i18n.SetLanguage(next["language"])
		respond(w, next)
	})
	s.mux.Handle("/media/", s.media)
	s.mux.Handle("/", http.FileServer(http.FS(ui.Files)))
}
func (s *Server) getCatalog(w http.ResponseWriter, r *http.Request) {
	if s.mode != "real" {
		if s.mode == "error" {
			failure(w, 503, errors.New("预览：目录加载失败"))
			return
		}
		if s.mode == "loading" {
			select {
			case <-time.After(8 * time.Second):
			case <-r.Context().Done():
				return
			}
		}
		entries := []catalog.Entry{}
		if s.mode != "empty" {
			entries = []catalog.Entry{{Repository: "fixture/demo", Name: "演示音乐源", Description: "用于确定性界面与音频流程验证"}}
		}
		respond(w, catalog.Snapshot{Entries: entries, UpdatedAt: time.Now()})
		return
	}
	result, e := s.catalog.Get(r.Context(), r.URL.Query().Get("refresh") == "1")
	if e != nil {
		failure(w, 502, e)
		return
	}
	respond(w, result)
}
func (s *Server) call(w http.ResponseWriter, r *http.Request) {
	id, method := r.PathValue("id"), r.PathValue("method")
	allowed := false
	for _, m := range sources.Methods {
		if m == method {
			allowed = true
		}
	}
	if !allowed || method == "stream" || method == "signIn" {
		failure(w, 400, errors.New("请使用专用播放或登录入口"))
		return
	}
	p, e := s.sources.Get(id)
	if e != nil {
		failure(w, 404, e)
		return
	}
	var params any
	if !decode(w, r, &params) {
		return
	}
	if s.mode == "error" && id == "fixture" {
		failure(w, 503, errors.New("预览：音乐源请求失败"))
		return
	}
	if s.mode == "loading" && id == "fixture" {
		select {
		case <-time.After(8 * time.Second):
		case <-r.Context().Done():
			return
		}
	}
	if s.mode == "empty" && id == "fixture" {
		respond(w, map[string]any{})
		return
	}
	raw, e := p.CallExport(method, params)
	if e != nil {
		failure(w, 422, e)
		return
	}
	raw = sources.Stamp(raw, id)
	var value any
	if json.Unmarshal(raw, &value) != nil {
		failure(w, 502, errors.New("音乐源响应无效"))
		return
	}
	s.images(value, p)
	respond(w, value)
}
func (s *Server) images(value any, p *plugin.Plugin) {
	switch x := value.(type) {
	case map[string]any:
		for k, v := range x {
			if k == "imageUrl" || k == "avatarUrl" {
				if address, ok := v.(string); ok && address != "" {
					u, e := url.Parse(address)
					if e == nil && (u.Scheme == "https" || u.Scheme == "http") {
						address = music.SizedImage(address, 400)
						x[k] = s.media.add(address, imageHeaders(p, address), 30*time.Minute, false)
					} else {
						x[k] = ""
					}
				}
			} else {
				s.images(v, p)
			}
		}
	case []any:
		for _, v := range x {
			s.images(v, p)
		}
	}
}
func (s *Server) startLogin(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	p, e := s.sources.Get(id)
	if e != nil {
		failure(w, 404, e)
		return
	}
	s.mu.Lock()
	if s.login.State == "waiting" {
		s.mu.Unlock()
		failure(w, 409, errors.New("请先完成或取消当前登录"))
		return
	}
	session := randomID()
	s.login = Login{ID: session, Source: id, State: "waiting"}
	s.mu.Unlock()
	p.OnSignInPrompt(func(prompt music.SignInPrompt) {
		s.mu.Lock()
		defer s.mu.Unlock()
		if s.login.ID == session {
			s.login.Prompt = prompt
		}
	})
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		_, e := p.SignIn()
		s.mu.Lock()
		defer s.mu.Unlock()
		if s.login.ID != session {
			return
		}
		if e != nil {
			s.login.State = "failed"
			s.login.Message = e.Error()
		} else {
			s.login.State = "complete"
		}
	}()
	respond(w, map[string]string{"id": session})
}
