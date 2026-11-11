package plugin

import (
	"archive/zip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"
)

// Only public installer requests use these gateways. Plugin fetch(), music
// accounts, media, and authenticated/private GitHub requests do not use them.
var githubProxies = []string{"https://gh-proxy.com/", "https://v4.gh-proxy.org/", "https://gh-proxy.org/"}

var routeHealth = struct {
	sync.Mutex
	until map[string]time.Time
}{until: map[string]time.Time{}}

func publicGitHubURL(address string) bool {
	u, e := url.Parse(address)
	if e != nil || u.Scheme != "https" || u.User != nil || u.Port() != "" {
		return false
	}
	switch u.Hostname() {
	case "github.com", "api.github.com", "raw.githubusercontent.com", "codeload.github.com", "objects.githubusercontent.com", "release-assets.githubusercontent.com":
		return true
	}
	return false
}

type progressKey struct{}

// WithInstallProgress reports phases without exposing gateway addresses to the UI.
func WithInstallProgress(ctx context.Context, report func(string)) context.Context {
	return context.WithValue(ctx, progressKey{}, report)
}

var errGitHubNotFound = errors.New("GitHub resource not found")

// githubRead retries the entire read, including body validation. A 200 HTML
// challenge page or a truncated ZIP must not count as a successful gateway.
func githubRead(ctx context.Context, address, accept, kind string, read func(*http.Response) error) error {
	routes := []string{}
	if publicGitHubURL(address) && !withToken() {
		for _, proxy := range githubProxies {
			routeHealth.Lock()
			cooling := time.Now().Before(routeHealth.until[proxy+kind])
			routeHealth.Unlock()
			if !cooling {
				routes = append(routes, proxy)
			}
		}
	}
	routes = append(routes, "")
	var last error
	for index, prefix := range routes {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if report, ok := ctx.Value(progressKey{}).(func(string)); ok {
			phase := "downloading"
			if index > 0 {
				phase = "retrying"
			}
			report(phase)
		}
		limit := 10 * time.Second
		if kind == "archive" {
			limit = 3 * time.Minute
		}
		attempt, cancel := context.WithTimeout(ctx, limit)
		// First byte and stalled reads are bounded separately from a progressing download.
		idle := time.AfterFunc(8*time.Second, cancel)
		err := func() error {
			res, e := githubSendContext(attempt, prefix+address, accept, prefix == "")
			if e != nil {
				return e
			}
			defer res.Body.Close()
			res.Body = &progressBody{ReadCloser: res.Body, timer: idle}
			idle.Reset(15 * time.Second)
			return read(res)
		}()
		idle.Stop()
		cancel()
		if err == nil {
			return nil
		}
		if prefix != "" && !errors.Is(err, errGitHubNotFound) {
			routeHealth.Lock()
			routeHealth.until[prefix+kind] = time.Now().Add(5 * time.Minute)
			routeHealth.Unlock()
		}
		last = err
	}
	return fmt.Errorf("所有下载线路均未完成请求，请重试: %w", last)
}

type progressBody struct {
	io.ReadCloser
	timer *time.Timer
}

func (b *progressBody) Read(p []byte) (int, error) {
	n, e := b.ReadCloser.Read(p)
	if n > 0 {
		b.timer.Reset(15 * time.Second)
	}
	return n, e
}

func githubSendContext(ctx context.Context, address, accept string, direct bool) (*http.Response, error) {
	token := ""
	if direct && strings.HasPrefix(address, githubAPI+"/") && withToken() {
		token = githubToken()
	}
	for {
		req, e := http.NewRequestWithContext(ctx, "GET", address, nil)
		if e != nil {
			return nil, e
		}
		req.Header.Set("User-Agent", "mygo-music-tv")
		if accept != "" {
			req.Header.Set("Accept", accept)
		}
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		res, e := installClient.Do(req)
		if e != nil || token == "" || res.StatusCode != http.StatusUnauthorized {
			return res, e
		}
		res.Body.Close()
		tokenRefused.Store(true)
		token = ""
	}
}

func githubGetContext(ctx context.Context, path string, out any) (int, error) {
	status := 0
	err := githubRead(ctx, githubAPI+path, "application/vnd.github+json", "api", func(res *http.Response) error {
		status = res.StatusCode
		if status == http.StatusNotFound {
			return errGitHubNotFound
		}
		if status != http.StatusOK {
			return fmt.Errorf("GitHub answered %s", res.Status)
		}
		b, e := io.ReadAll(io.LimitReader(res.Body, 4<<20))
		if e != nil {
			return e
		}
		var shape struct {
			Tag string `json:"tag_name"`
			Zip string `json:"zipball_url"`
			SHA string `json:"sha"`
		}
		if e = json.Unmarshal(b, &shape); e != nil {
			return e
		}
		if strings.HasSuffix(path, "/releases/latest") && (shape.Tag == "" || shape.Zip == "") {
			return errors.New("无效的版本响应")
		}
		if strings.HasSuffix(path, "/commits/HEAD") && shape.SHA == "" {
			return errors.New("无效的提交响应")
		}
		return json.Unmarshal(b, out)
	})
	if errors.Is(err, errGitHubNotFound) {
		return http.StatusNotFound, nil
	}
	return status, err
}

func downloadContext(ctx context.Context, address, path string) error {
	accept := ""
	if strings.Contains(address, "/releases/assets/") {
		accept = "application/octet-stream"
	}
	err := githubRead(ctx, address, accept, "archive", func(res *http.Response) error {
		if res.StatusCode != http.StatusOK {
			return fmt.Errorf("downloading the plugin: %s", res.Status)
		}
		f, e := os.Create(path)
		if e != nil {
			return e
		}
		n, e := io.Copy(f, io.LimitReader(res.Body, maxArchive+1))
		closeErr := f.Close()
		if e != nil {
			return e
		}
		if closeErr != nil {
			return closeErr
		}
		if n > maxArchive {
			return errors.New("the plugin's archive is too large")
		}
		z, e := zip.OpenReader(path)
		if e != nil {
			return fmt.Errorf("无效的插件压缩包: %w", e)
		}
		defer z.Close()
		if len(z.File) > maxFiles {
			return errors.New("too many files")
		}
		// Reading verifies CRC and catches damaged gateways before installation.
		var total int64
		for _, entry := range z.File {
			r, e := entry.Open()
			if e != nil {
				return e
			}
			n, e := io.Copy(io.Discard, io.LimitReader(r, maxUnpacked-total+1))
			r.Close()
			total += n
			if e != nil {
				return e
			}
			if total > maxUnpacked {
				return errors.New("the plugin is too large")
			}
		}
		return nil
	})
	if err != nil {
		os.Remove(path)
	}
	return err
}
