package server

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"mygo-music-tv/core/internal/music"
	"mygo-music-tv/core/internal/plugin"
)

type lease struct {
	URL     string
	Headers map[string]string
	Expires time.Time
	Context context.Context
	Cancel  context.CancelFunc
	Fixture bool
	Image   bool
	Used    time.Time
	Source  *plugin.Plugin
}
type media struct {
	sync.Mutex
	leases  map[string]*lease
	client  *http.Client
	artwork string // Current cover must survive browsing other image-heavy pages.
}

func newMedia() *media {
	return &media{leases: map[string]*lease{}, client: &http.Client{Transport: &http.Transport{Proxy: http.ProxyFromEnvironment, ResponseHeaderTimeout: 25 * time.Second, IdleConnTimeout: 60 * time.Second}}}
}
func (m *media) add(address string, headers map[string]string, d time.Duration, fixture bool) string {
	return m.addLease(address, headers, d, fixture, false, nil)
}

// Artwork is bounded metadata, not a timed audio capability. A queue can live
// longer than 30 minutes; keep its cover usable until LRU eviction or core exit.
func (m *media) addImage(address string, source *plugin.Plugin) string {
	return m.addLease(address, nil, 0, false, true, source)
}

func (m *media) protectArtwork(path string) {
	m.Lock()
	defer m.Unlock()
	m.artwork = strings.TrimPrefix(path, "/media/")
}

func (m *media) has(path string) bool {
	m.Lock()
	defer m.Unlock()
	l := m.leases[strings.TrimPrefix(path, "/media/")]
	return l != nil && (l.Image || time.Now().Before(l.Expires))
}

func (m *media) addLease(address string, headers map[string]string, d time.Duration, fixture, image bool, source *plugin.Plugin) string {
	m.Lock()
	defer m.Unlock()
	now := time.Now()
	for k, v := range m.leases {
		if !v.Image && now.After(v.Expires) {
			v.Cancel()
			delete(m.leases, k)
		}
	}
	if len(m.leases) >= 1500 {
		var oldest string
		var at time.Time
		for k, v := range m.leases {
			if k == m.artwork {
				continue
			}
			// Image browsing must not evict an active audio stream.
			if oldest != "" && m.leases[oldest].Image && !v.Image {
				continue
			}
			if oldest == "" || v.Image && !m.leases[oldest].Image || v.Used.Before(at) {
				oldest = k
				at = v.Used
			}
		}
		m.leases[oldest].Cancel()
		delete(m.leases, oldest)
	}
	ctx, cancel := context.WithCancel(context.Background())
	id := randomID()
	m.leases[id] = &lease{URL: address, Headers: headers, Expires: now.Add(d), Context: ctx, Cancel: cancel, Fixture: fixture, Image: image, Used: now, Source: source}
	return "/media/" + id
}
func (m *media) revoke(path string) {
	id := strings.TrimPrefix(path, "/media/")
	m.Lock()
	defer m.Unlock()
	if l := m.leases[id]; l != nil {
		l.Cancel()
		delete(m.leases, id)
	}
}
func (m *media) close() {
	m.Lock()
	defer m.Unlock()
	for _, l := range m.leases {
		l.Cancel()
	}
	m.leases = map[string]*lease{}
}
func (m *media) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" && r.Method != "HEAD" {
		w.WriteHeader(405)
		return
	}
	m.Lock()
	l := m.leases[strings.TrimPrefix(r.URL.Path, "/media/")]
	if l != nil {
		l.Used = time.Now()
	}
	m.Unlock()
	if l == nil || !l.Image && time.Now().After(l.Expires) {
		http.Error(w, "媒体会话已过期", 410)
		return
	}
	if l.Fixture {
		http.ServeFile(w, r, l.URL)
		return
	}
	u, e := url.Parse(l.URL)
	if e != nil || (u.Scheme != "http" && u.Scheme != "https") {
		http.Error(w, "不支持的媒体地址", 422)
		return
	}
	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()
	stop := context.AfterFunc(l.Context, cancel)
	defer stop()
	req, e := http.NewRequestWithContext(ctx, r.Method, l.URL, nil)
	if e != nil {
		w.WriteHeader(502)
		return
	}
	req.Header.Set("User-Agent", music.Agent)
	headers := l.Headers
	if l.Image && l.Source != nil {
		// Resolve current credentials rather than retaining a stale login token.
		headers = imageHeaders(l.Source, l.URL)
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	for _, k := range []string{"Range", "If-Range"} {
		if v := r.Header.Get(k); v != "" {
			req.Header.Set(k, v)
		}
	}
	client := *m.client
	client.CheckRedirect = func(next *http.Request, via []*http.Request) error {
		if len(via) >= 10 {
			return errors.New("too many redirects")
		}
		if next.URL.Hostname() != u.Hostname() {
			for k := range headers {
				next.Header.Del(k)
			}
			next.Header.Del("Cookie")
			next.Header.Del("Authorization")
		}
		return nil
	}
	res, e := client.Do(req)
	if e != nil {
		http.Error(w, "媒体请求失败", 502)
		return
	}
	defer res.Body.Close()
	for _, k := range []string{"Content-Type", "Content-Length", "Content-Range", "Accept-Ranges", "ETag", "Last-Modified"} {
		if v := res.Header.Get(k); v != "" {
			w.Header().Set(k, v)
		}
	}
	w.Header().Set("Cache-Control", "private, no-store")
	w.WriteHeader(res.StatusCode)
	if r.Method != "HEAD" {
		_, _ = io.Copy(w, res.Body)
	}
}
func imageHeaders(p *plugin.Plugin, address string) map[string]string {
	u, _ := url.Parse(address)
	return p.HeadersFor(u, plugin.KindImage)
}
