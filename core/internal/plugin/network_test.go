package plugin

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"reflect"
	"strings"
	"testing"
	"time"
)

type installerTransport func(*http.Request) (*http.Response, error)

func (f installerTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func networkTest(t *testing.T, f installerTransport) {
	t.Helper()
	api, token, client, proxies := githubAPI, githubToken, installClient, githubProxies
	githubAPI = "https://api.github.com"
	githubToken = func() string { return "" }
	installClient = &http.Client{Transport: f}
	githubProxies = []string{"https://gh-proxy.com/", "https://v4.gh-proxy.org/", "https://gh-proxy.org/"}
	routeHealth.Lock()
	routeHealth.until = map[string]time.Time{}
	routeHealth.Unlock()
	t.Cleanup(func() {
		githubAPI, githubToken, installClient, githubProxies = api, token, client, proxies
		routeHealth.Lock()
		routeHealth.until = map[string]time.Time{}
		routeHealth.Unlock()
	})
}

func installerResponse(r *http.Request, status int, b []byte) *http.Response {
	return &http.Response{StatusCode: status, Status: http.StatusText(status), Body: io.NopCloser(bytes.NewReader(b)), Header: http.Header{}, Request: r}
}

func TestGitHubGatewaysFallBackAndValidateBodies(t *testing.T) {
	zip := goodArchive(t, "")
	var got []string
	networkTest(t, func(r *http.Request) (*http.Response, error) {
		if r.Header.Get("Authorization") != "" {
			t.Fatal("credential sent to gateway")
		}
		got = append(got, r.URL.Host)
		switch r.URL.Host {
		case "gh-proxy.com":
			return installerResponse(r, 200, []byte("<html>verification</html>")), nil
		case "v4.gh-proxy.org":
			return installerResponse(r, 429, nil), nil
		case "gh-proxy.org":
			return installerResponse(r, 200, []byte(`{"unexpected":true}`)), nil
		case "api.github.com":
			return installerResponse(r, 200, []byte(`{"tag_name":"v2","zipball_url":"https://github.com/owner/repo/archive/v2.zip"}`)), nil
		case "github.com":
			return installerResponse(r, 200, zip), nil
		}
		return nil, errors.New("unexpected URL")
	})
	rel, e := Latest("owner/repo")
	if e != nil || rel.Version != "v2" {
		t.Fatal(rel, e)
	}
	want := []string{"gh-proxy.com", "v4.gh-proxy.org", "gh-proxy.org", "api.github.com"}
	if !reflect.DeepEqual(got, want) {
		t.Fatal(got)
	}
	got = nil
	if e = downloadContext(context.Background(), rel.URL, t.TempDir()+"/plugin.zip"); e != nil {
		t.Fatal(e)
	}
	want[3] = "github.com"
	if !reflect.DeepEqual(got, want) {
		t.Fatal(got)
	}
	got = nil
	_, e = Latest("owner/repo")
	if e != nil || !reflect.DeepEqual(got, []string{"api.github.com"}) {
		t.Fatal("failed API routes were retried", got, e)
	}
}

func TestGitHubDownloadRetriesTruncatedAndCorruptZip(t *testing.T) {
	archive := goodArchive(t, "")
	calls := 0
	networkTest(t, func(r *http.Request) (*http.Response, error) {
		calls++
		if r.URL.Host == "gh-proxy.com" {
			return installerResponse(r, 200, archive[:len(archive)/2]), nil
		}
		return installerResponse(r, 200, archive), nil
	})
	if e := downloadContext(context.Background(), "https://github.com/a/b/archive/v1.zip", t.TempDir()+"/plugin.zip"); e != nil || calls != 2 {
		t.Fatal(e, calls)
	}
}

func TestGitHubCredentialsAndCancellationStayLocal(t *testing.T) {
	t.Run("token bypasses public gateways", func(t *testing.T) {
		networkTest(t, func(r *http.Request) (*http.Response, error) {
			if r.URL.Host != "api.github.com" || r.Header.Get("Authorization") != "Bearer private-token" {
				t.Fatal("token route", r.URL.Host)
			}
			return installerResponse(r, 200, []byte(`{"sha":"abcdef1234567890"}`)), nil
		})
		githubToken = func() string { return "private-token" }
		var out any
		if _, e := githubGetContext(context.Background(), "/repos/a/b/commits/HEAD", &out); e != nil {
			t.Fatal(e)
		}
	})
	t.Run("cancel aborts fallback", func(t *testing.T) {
		calls := 0
		networkTest(t, func(r *http.Request) (*http.Response, error) {
			calls++
			<-r.Context().Done()
			return nil, r.Context().Err()
		})
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
		defer cancel()
		_, e := LatestContext(ctx, "a/b")
		if e == nil || calls != 1 {
			t.Fatal(e, calls)
		}
	})
	t.Run("non GitHub URL stays direct", func(t *testing.T) {
		networkTest(t, func(r *http.Request) (*http.Response, error) {
			if strings.Contains(r.URL.Host, "proxy") {
				t.Fatal("music proxied")
			}
			return installerResponse(r, 200, []byte("ok")), nil
		})
		if e := githubRead(context.Background(), "https://music.example.com/file", "", "api", func(r *http.Response) error { return nil }); e != nil {
			t.Fatal(e)
		}
	})
}
