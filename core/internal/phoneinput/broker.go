// Package phoneinput provides a short-lived LAN input service, separate from
// the loopback application API. Phone capabilities authorize one field once.
package phoneinput

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode"
	"unicode/utf8"

	"mygo-music-tv/ui"
)

const Lifetime = 5 * time.Minute
const ownerLease = 30 * time.Second
const MaxText = 200

// Request contains presentation context, never account credentials or API tokens.
type Request struct {
	Target   string `json:"target"`
	Context  string `json:"context"`
	Initial  string `json:"initial"`
	Language string `json:"language"`
	Theme    string `json:"theme"`
	Address  string `json:"address"`
}
type View struct {
	ID        string `json:"id,omitempty"`
	Target    string `json:"target"`
	Context   string `json:"context"`
	Initial   string `json:"initial"`
	Language  string `json:"language"`
	Theme     string `json:"theme"`
	State     string `json:"state"`
	URL       string `json:"url,omitempty"`
	PairCode  string `json:"pairCode"`
	ExpiresAt int64  `json:"expiresAt"`
	ServerNow int64  `json:"serverNow"`
	Value     string `json:"value,omitempty"`
}
type session struct {
	request                            Request
	id, token, code, url, state, value string
	created, expires, owner            time.Time
	server                             *http.Server
	timer                              *time.Timer
}
type Broker struct {
	mu     sync.Mutex
	active *session
	closed bool
	// Functions are replaceable by package tests; production uses real time/LAN.
	now     func() time.Time
	address func() (string, error)
}

func New() *Broker { return &Broker{now: time.Now, address: lanAddress} }
func randomToken() string {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}
func validText(s string) bool {
	if !utf8.ValidString(s) || utf8.RuneCountInString(s) > MaxText {
		return false
	}
	for _, r := range s {
		if unicode.IsControl(r) {
			return false
		}
	}
	return true
}
func localIP(ip net.IP) bool {
	return ip != nil && ip.To4() != nil && (ip.IsPrivate() || ip.IsLoopback() || ip.IsLinkLocalUnicast())
}
func lanAddress() (string, error) {
	interfaces, err := net.Interfaces()
	if err != nil {
		return "", err
	}
	// Prefer physical Ethernet/Wi-Fi over virtual adapters. Android supplies its
	// active LinkProperties address because Go interface discovery can be limited.
	sort.SliceStable(interfaces, func(i, j int) bool { return physical(interfaces[i].Name) && !physical(interfaces[j].Name) })
	for _, iface := range interfaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 || virtual(iface.Name) {
			continue
		}
		addrs, _ := iface.Addrs()
		for _, addr := range addrs {
			ip, _, e := net.ParseCIDR(addr.String())
			if e == nil && localIP(ip) && !ip.IsLoopback() {
				return ip.String(), nil
			}
		}
	}
	return "", errors.New("未找到可用的局域网地址，请检查网络连接")
}
func physical(name string) bool {
	return strings.HasPrefix(name, "en") || strings.HasPrefix(name, "eth") || strings.HasPrefix(name, "wlan")
}
func virtual(name string) bool {
	for _, p := range []string{"utun", "tun", "tap", "tailscale", "docker", "veth", "bridge"} {
		if strings.HasPrefix(name, p) {
			return true
		}
	}
	return false
}
func stopHTTP(s *session) {
	if s.timer != nil {
		s.timer.Stop()
	}
	// Graceful shutdown lets the phone receive its final submission response.
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		_ = s.server.Shutdown(ctx)
		_ = s.server.Close()
	}()
}
func (b *Broker) Start(q Request) (View, error) {
	if q.Target != "resource" && q.Target != "plugins" || !validText(q.Initial) || !validText(q.Context) {
		return View{}, errors.New("扫码输入请求无效")
	}
	if q.Language != "zh-TW" {
		q.Language = "zh-CN"
	}
	if q.Theme != "dark" {
		q.Theme = "light"
	}
	address := q.Address
	if address == "" {
		var err error
		address, err = b.address()
		if err != nil {
			return View{}, err
		}
	}
	ip := net.ParseIP(address)
	if !localIP(ip) || ip.IsLoopback() && q.Address != "" {
		return View{}, errors.New("未找到可用的局域网地址，请检查网络连接")
	}
	listener, err := net.Listen("tcp4", "0.0.0.0:0")
	if err != nil {
		return View{}, errors.New("手机输入连接无法启动，请重试")
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.closed {
		_ = listener.Close()
		return View{}, errors.New("手机输入连接已关闭")
	}
	if b.active != nil {
		b.active.state = "cancelled"
		b.active.value = ""
		stopHTTP(b.active)
	}
	now := b.now()
	s := &session{request: q, id: randomToken(), token: randomToken(), created: now, expires: now.Add(Lifetime), owner: now, state: "waiting"}
	s.code = strings.ToUpper(s.token[:6])
	s.url = "http://" + net.JoinHostPort(ip.String(), fmt.Sprint(listener.Addr().(*net.TCPAddr).Port)) + "/input#" + s.token
	s.server = &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { b.servePhone(s, w, r) }), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 10 * time.Second, IdleTimeout: 15 * time.Second, MaxHeaderBytes: 8192}
	b.active = s
	s.timer = time.AfterFunc(time.Second, func() { b.expire(s) })
	go func() { _ = s.server.Serve(listener) }()
	return b.view(s, true), nil
}
func (b *Broker) expire(s *session) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.active != s || s.state == "expired" || s.state == "cancelled" {
		return
	}
	now := b.now()
	if !now.Before(s.expires) || now.Sub(s.owner) >= ownerLease {
		s.state = "expired"
		s.value = ""
		stopHTTP(s)
		return
	}
	s.timer = time.AfterFunc(time.Second, func() { b.expire(s) })
}
func (b *Broker) view(s *session, owner bool) View {
	v := View{Target: s.request.Target, Context: s.request.Context, Initial: s.request.Initial, Language: s.request.Language, Theme: s.request.Theme, State: s.state, PairCode: s.code, ExpiresAt: s.expires.UnixMilli(), ServerNow: b.now().UnixMilli()}
	if owner {
		v.ID = s.id
		v.URL = s.url
		v.Value = s.value
	}
	return v
}
func (b *Broker) Status(id string) (View, bool) {
	b.mu.Lock()
	defer b.mu.Unlock()
	s := b.active
	if s == nil || s.id != id {
		return View{}, false
	}
	now := b.now()
	if s.state != "expired" && (!now.Before(s.expires) || now.Sub(s.owner) >= ownerLease) {
		s.state = "expired"
		s.value = ""
		stopHTTP(s)
	}
	s.owner = now
	return b.view(s, true), true
}

// A time-scoped Cancel is used by native background events. A delayed callback cannot
// cancel a new input session created after the app has returned to foreground.
func (b *Broker) Cancel(id string, before int64) {
	b.mu.Lock()
	defer b.mu.Unlock()
	s := b.active
	if s == nil || id != "" && s.id != id || id == "" && before > 0 && s.created.UnixMilli() > before {
		return
	}
	s.state = "cancelled"
	s.value = ""
	b.active = nil
	stopHTTP(s)
}
func (b *Broker) Close() {
	b.mu.Lock()
	b.closed = true
	if b.active != nil {
		b.active.value = ""
		stopHTTP(b.active)
		b.active = nil
	}
	b.mu.Unlock()
}
func phoneJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
func phoneError(w http.ResponseWriter, status int, code string) {
	phoneJSON(w, status, map[string]string{"code": code})
}
func (b *Broker) servePhone(s *session, w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Referrer-Policy", "no-referrer")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'")
	remote, _, _ := net.SplitHostPort(r.RemoteAddr)
	host, port, err := net.SplitHostPort(r.Host)
	expected, expectedPort, _ := net.SplitHostPort(strings.TrimPrefix(strings.Split(s.url, "/input#")[0], "http://"))
	if !localIP(net.ParseIP(remote)) || err != nil || port != expectedPort || host != expected && !net.ParseIP(host).IsLoopback() {
		phoneError(w, 403, "forbidden")
		return
	}
	if origin := r.Header.Get("Origin"); origin != "" && origin != "http://"+r.Host {
		phoneError(w, 403, "forbidden")
		return
	}
	if r.URL.Path != "/input/session" {
		if r.Method != "GET" {
			phoneError(w, 405, "method")
			return
		}
		file := ""
		switch r.URL.Path {
		case "/input":
			file = "phone.html"
		case "/phone.js", "/phone.css", "/i18n.js", "/locales/zh-CN.js", "/locales/zh-TW.js":
			file = strings.TrimPrefix(r.URL.Path, "/")
		}
		if file == "" {
			phoneError(w, 404, "missing")
			return
		}
		data, e := ui.Files.ReadFile(file)
		if e != nil {
			phoneError(w, 404, "missing")
			return
		}
		content := "text/html; charset=utf-8"
		if strings.HasSuffix(file, ".js") {
			content = "text/javascript; charset=utf-8"
		}
		if strings.HasSuffix(file, ".css") {
			content = "text/css; charset=utf-8"
		}
		w.Header().Set("Content-Type", content)
		_, _ = w.Write(data)
		return
	}
	if subtle.ConstantTimeCompare([]byte(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")), []byte(s.token)) != 1 {
		phoneError(w, 401, "unauthorized")
		return
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.active != s || s.state == "cancelled" || s.state == "expired" || !b.now().Before(s.expires) || b.now().Sub(s.owner) >= ownerLease {
		phoneError(w, 410, "expired")
		return
	}
	switch r.Method {
	case "GET":
		if s.state == "waiting" {
			s.state = "connected"
		}
		phoneJSON(w, 200, b.view(s, false))
	case "POST":
		if s.state == "submitted" {
			phoneError(w, 409, "submitted")
			return
		}
		var q struct {
			Target string `json:"target"`
			Value  string `json:"value"`
		}
		body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 2048))
		if err != nil || !utf8.Valid(body) {
			phoneError(w, 400, "invalid")
			return
		}
		decoder := json.NewDecoder(bytes.NewReader(body))
		decoder.DisallowUnknownFields()
		if decoder.Decode(&q) != nil || decoder.Decode(&struct{}{}) != io.EOF || q.Target != s.request.Target || !validText(q.Value) || strings.TrimSpace(q.Value) == "" {
			phoneError(w, 400, "invalid")
			return
		}
		s.value = strings.TrimSpace(q.Value)
		s.state = "submitted"
		phoneJSON(w, 200, map[string]string{"state": "submitted"})
	default:
		phoneError(w, 405, "method")
	}
}
