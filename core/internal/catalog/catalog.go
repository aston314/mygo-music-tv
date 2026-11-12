// Package catalog discovers repositories from the official directory's install links.
package catalog

import (
	"context"
	_ "embed"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"golang.org/x/net/html"
	"mygo-music-tv/core/internal/plugin"
)

type Entry struct {
	Repository  string `json:"repository"`
	Name        string `json:"name"`
	Description string `json:"description"`
}
type Snapshot struct {
	Entries    []Entry   `json:"entries"`
	UpdatedAt  time.Time `json:"updatedAt"`
	Stale      bool      `json:"stale"`
	Message    string    `json:"message,omitempty"`
	Source     string    `json:"source,omitempty"`
	Refreshing bool      `json:"refreshing,omitempty"`
}
type Catalog struct {
	mu                   sync.Mutex
	URL, MirrorURL, Path string
	Client               *http.Client
	saved                Snapshot
	seeded               bool
	lastAttempt          time.Time
	flight               chan struct{}
	lastError            error
}

//go:embed bundled.json
var bundled []byte

func New(address, path string) *Catalog {
	return NewWithMirror(address, "", path)
}

func NewWithMirror(address, mirror, path string) *Catalog {
	c := &Catalog{URL: address, MirrorURL: mirror, Path: path, Client: &http.Client{Timeout: 4 * time.Second}}
	if b, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(b, &c.saved)
	}
	if len(c.saved.Entries) == 0 {
		var seed struct {
			URL      string   `json:"url"`
			Snapshot Snapshot `json:"snapshot"`
		}
		if json.Unmarshal(bundled, &seed) == nil && seed.URL == address {
			c.saved = seed.Snapshot
			c.saved.Stale = true
			c.saved.Message = "正在使用内置目录，可联网刷新获取最新插件"
			c.seeded = true
		}
	}
	for i := range c.saved.Entries {
		cleanEntry(&c.saved.Entries[i])
	}
	return c
}

// Migrate old cached card text only when its exact repository header is present.
// A description that happens to mention GitHub or a number is not a header.
func cleanEntry(entry *Entry) {
	value := cleanCachedDescription(entry.Description)
	parts := strings.Split(entry.Repository, "/")
	for _, name := range []string{entry.Name, strings.TrimPrefix(parts[len(parts)-1], "mygo-music-")} {
		prefix := name + " " + entry.Repository
		if name != "" && strings.HasPrefix(value, prefix+" ") {
			value = strings.TrimSpace(strings.TrimPrefix(value, prefix))
			fields := strings.Fields(value)
			if len(fields) > 0 && strings.Trim(fields[0], "0123456789") == "" {
				value = strings.TrimSpace(strings.TrimPrefix(value, fields[0]))
			}
			break
		}
	}
	entry.Description = value
}

// Older snapshots included the directory's adjacent install/repository buttons.
// Only remove their trailing label pair; GitHub mentions in prose stay intact.
func cleanCachedDescription(value string) string {
	value = strings.TrimSpace(value)
	for _, labels := range []string{"安装 GitHub", "安裝 GitHub", "Install GitHub"} {
		if value == labels {
			return ""
		}
		value = strings.TrimSuffix(value, " "+labels)
	}
	return value
}
func installLink(n *html.Node) bool {
	if n.Type != html.ElementNode || n.Data != "a" {
		return false
	}
	u, err := url.Parse(attr(n, "href"))
	return err == nil && u.Scheme == "mygo-music" && u.Host == "install-plugin"
}
func directoryAction(n *html.Node) bool {
	if installLink(n) {
		return true
	}
	if n.Type != html.ElementNode || n.Data != "a" || n.Parent == nil {
		return false
	}
	u, err := url.Parse(attr(n, "href"))
	if err != nil || !strings.EqualFold(u.Hostname(), "github.com") {
		return false
	}
	// The GitHub action sits beside the install link. Keep repository titles
	// and meaningful GitHub links elsewhere in the description.
	for sibling := n.Parent.FirstChild; sibling != nil; sibling = sibling.NextSibling {
		if installLink(sibling) {
			return true
		}
	}
	return false
}
func text(n *html.Node) string {
	if directoryAction(n) {
		return ""
	}
	if n.Type == html.TextNode {
		return n.Data
	}
	var b strings.Builder
	for a := n.FirstChild; a != nil; a = a.NextSibling {
		b.WriteString(text(a))
		b.WriteByte(' ')
	}
	return strings.Join(strings.Fields(b.String()), " ")
}

func hasClass(n *html.Node, class string) bool {
	for _, value := range strings.Fields(attr(n, "class")) {
		if value == class {
			return true
		}
	}
	return false
}

func cardDescription(n *html.Node) string {
	if n.Type == html.ElementNode && (n.Data == "h2" || n.Data == "h3" || hasClass(n, "plugin-card-head") || hasClass(n, "plugin-title") || hasClass(n, "plugin-stars") || hasClass(n, "plugin-repo") || hasClass(n, "plugin-actions") || directoryAction(n)) {
		return ""
	}
	if n.Type == html.TextNode {
		return n.Data
	}
	var b strings.Builder
	for child := n.FirstChild; child != nil; child = child.NextSibling {
		b.WriteString(cardDescription(child))
		b.WriteByte(' ')
	}
	return strings.Join(strings.Fields(b.String()), " ")
}

func cardName(n *html.Node) string {
	if n.Type == html.ElementNode && (n.Data == "h2" || n.Data == "h3") {
		return text(n)
	}
	for child := n.FirstChild; child != nil; child = child.NextSibling {
		if name := cardName(child); name != "" {
			return name
		}
	}
	return ""
}
func attr(n *html.Node, name string) string {
	for _, a := range n.Attr {
		if a.Key == name {
			return a.Val
		}
	}
	return ""
}
func Parse(r io.Reader) ([]Entry, error) {
	doc, err := html.Parse(r)
	if err != nil {
		return nil, err
	}
	var out []Entry
	seen := map[string]bool{}
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.ElementNode && n.Data == "a" {
			u, e := url.Parse(attr(n, "href"))
			if e == nil && u.Scheme == "mygo-music" && u.Host == "install-plugin" {
				repo, e := plugin.ParseRepo(u.Query().Get("repo"))
				key := strings.ToLower(repo)
				if e == nil && !seen[key] {
					seen[key] = true
					name := strings.Split(repo, "/")[1]
					description := ""
					// Semantic card containers may change styling without changing discovery.
					card := n.Parent
					for a := n.Parent; a != nil && a.Data != "body"; a = a.Parent {
						if a.Data == "article" || a.Data == "li" {
							card = a
							break
						}
					}
					if card != nil {
						if title := cardName(card); title != "" {
							name = title
						}
						description = cardDescription(card)
						if len([]rune(description)) > 320 {
							description = string([]rune(description)[:320])
						}
					}
					out = append(out, Entry{repo, name, description})
				}
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(doc)
	if len(out) == 0 {
		return nil, errors.New("官方目录未包含有效安装链接，请稍后重试")
	}
	return out, nil
}

// Get always serves usable cache immediately. One bounded background refresh is
// shared by every caller; explicit refresh waits without holding the cache lock.
func (c *Catalog) Get(ctx context.Context, refresh bool) (Snapshot, error) {
	c.mu.Lock()
	if !refresh && len(c.saved.Entries) > 0 {
		due := c.seeded || (time.Since(c.saved.UpdatedAt) >= 30*time.Minute && time.Since(c.lastAttempt) >= 30*time.Minute)
		if due && c.flight == nil {
			c.startRefresh()
		}
		result := c.saved
		result.Refreshing = c.flight != nil
		c.mu.Unlock()
		return result, nil
	}
	if c.flight == nil {
		c.startRefresh()
	}
	done := c.flight
	c.mu.Unlock()
	select {
	case <-ctx.Done():
		return Snapshot{}, ctx.Err()
	case <-done:
		c.mu.Lock()
		defer c.mu.Unlock()
		if len(c.saved.Entries) > 0 {
			return c.saved, nil
		}
		return Snapshot{}, c.lastError
	}
}

// Caller holds mu. Fetching never holds it, so re-entering the market stays fast.
func (c *Catalog) startRefresh() {
	c.seeded = false
	c.lastAttempt = time.Now()
	c.flight = make(chan struct{})
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 22*time.Second)
		defer cancel()
		result, err := c.fetch(ctx)
		c.mu.Lock()
		defer c.mu.Unlock()
		c.lastError = err
		if err == nil {
			// A proxy may cache an older JSON. Never replace newer usable local data.
			if len(c.saved.Entries) == 0 || !result.UpdatedAt.Before(c.saved.UpdatedAt) {
				c.saved = result
				c.persist(result)
			} else {
				c.saved.Stale = true
				c.saved.Message = "刷新失败，显示最近成功获取的目录"
			}
		} else if len(c.saved.Entries) > 0 {
			c.saved.Stale = true
			c.saved.Message = "刷新失败，显示最近成功获取的目录"
		}
		close(c.flight)
		c.flight = nil
	}()
}

func (c *Catalog) persist(s Snapshot) {
	if b, e := json.Marshal(s); e == nil {
		if e = os.MkdirAll(filepath.Dir(c.Path), 0700); e == nil {
			if e = os.WriteFile(c.Path+".part", b, 0600); e == nil {
				_ = os.Rename(c.Path+".part", c.Path)
			}
		}
	}
}

func (c *Catalog) fetch(ctx context.Context) (Snapshot, error) {
	direct, cancel := context.WithTimeout(ctx, 4*time.Second)
	req, err := http.NewRequestWithContext(direct, "GET", c.URL, nil)
	var entries []Entry
	if err == nil {
		req.Header.Set("User-Agent", "MyMusicPlus-Catalog/1")
		var res *http.Response
		res, err = c.Client.Do(req)
		if err == nil {
			if res.StatusCode != http.StatusOK {
				err = errors.New("官方目录暂时不可用")
			} else {
				var b []byte
				b, err = io.ReadAll(io.LimitReader(res.Body, (8<<20)+1))
				if err == nil && len(b) > 8<<20 {
					err = errors.New("目录过大")
				}
				if err == nil {
					entries, err = Parse(strings.NewReader(string(b)))
				}
			}
			res.Body.Close()
		}
	}
	cancel()
	if err == nil {
		return Snapshot{Entries: entries, UpdatedAt: time.Now().UTC(), Source: "official"}, nil
	}
	if c.MirrorURL == "" {
		return Snapshot{}, err
	}
	var result Snapshot
	_, mirrorErr := plugin.ReadPublicJSON(ctx, c.MirrorURL, 8<<20, func(b []byte) error {
		var e error
		result, e = ParseMirror(b, c.URL)
		if e == nil {
			c.mu.Lock()
			older := len(c.saved.Entries) > 0 && result.UpdatedAt.Before(c.saved.UpdatedAt)
			c.mu.Unlock()
			if older {
				return errors.New("public directory is older than local cache")
			}
		}
		return e
	})
	if mirrorErr != nil {
		return Snapshot{}, mirrorErr
	}
	return result, nil
}

// ParseMirror accepts only a complete, bounded snapshot of this official source.
func ParseMirror(b []byte, source string) (Snapshot, error) {
	var doc struct {
		Schema    int       `json:"schema"`
		Origin    string    `json:"source"`
		UpdatedAt time.Time `json:"updatedAt"`
		Entries   []Entry   `json:"entries"`
	}
	if len(b) > 8<<20 || json.Unmarshal(b, &doc) != nil || doc.Schema != 1 || doc.Origin != source || doc.UpdatedAt.IsZero() || doc.UpdatedAt.After(time.Now().Add(5*time.Minute)) || len(doc.Entries) == 0 || len(doc.Entries) > 2000 {
		return Snapshot{}, errors.New("invalid public plugin directory")
	}
	seen := map[string]bool{}
	for i := range doc.Entries {
		entry := &doc.Entries[i]
		repo, err := plugin.ParseRepo(entry.Repository)
		key := strings.ToLower(repo)
		if err != nil || repo != entry.Repository || seen[key] || strings.TrimSpace(entry.Name) == "" || len([]rune(entry.Name)) > 200 || len([]rune(entry.Description)) > 320 {
			return Snapshot{}, errors.New("invalid public plugin entry")
		}
		seen[key] = true
		cleanEntry(entry)
	}
	result := Snapshot{Entries: doc.Entries, UpdatedAt: doc.UpdatedAt, Source: "public-mirror"}
	if time.Since(doc.UpdatedAt) > 7*24*time.Hour {
		result.Stale = true
		result.Message = "刷新失败，显示最近成功获取的目录"
	}
	return result, nil
}
