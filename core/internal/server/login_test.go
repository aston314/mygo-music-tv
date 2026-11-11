package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func loginFixture(t *testing.T, body string) *Server {
	t.Helper()
	s := newTest(t)
	dir := t.TempDir()
	_ = os.WriteFile(filepath.Join(dir, "plugin.json"), []byte(`{"id":"web","name":"Web","permissions":{"network":["example.com","accounts.example.com","api.example.com"]}}`), 0600)
	_ = os.WriteFile(filepath.Join(dir, "index.js"), []byte(body), 0600)
	if err := s.sources.AddFixture(dir); err != nil {
		t.Fatal(err)
	}
	return s
}
func loginRequest(t *testing.T, s *Server, method, path, body string, native bool) *httptest.ResponseRecorder {
	t.Helper()
	r := httptest.NewRequest(method, "http://127.0.0.1"+path, strings.NewReader(body))
	if native {
		r.Header.Set("Authorization", "Bearer "+s.token)
	} else {
		r.AddCookie(&http.Cookie{Name: "mygo_session", Value: s.token})
	}
	w := httptest.NewRecorder()
	s.ServeHTTP(w, r)
	return w
}
func waitLogin(t *testing.T, s *Server, want func(Login) bool) Login {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		s.mu.Lock()
		l := s.login
		s.mu.Unlock()
		if want(l) {
			return l
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatal("login did not settle")
	return Login{}
}

const cookieLogin = `export async function signIn(){const {cookie}=await host.webSignIn({url:'https://accounts.example.com/login',cookiesOf:'https://api.example.com/',until:['SID','HSID']});host.storage.set('cookie',cookie);return {id:'me',name:'TV'};} export function account(){return host.storage.get('cookie')?{id:'me',name:'TV'}:null;}`

func TestNativeWebLoginKeepsCredentialsOutOfBrowserAndStorageIsPerInstance(t *testing.T) {
	s := loginFixture(t, cookieLogin)
	if w := loginRequest(t, s, "POST", "/api/login/fixture", "{}", false); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	l := waitLogin(t, s, func(l Login) bool { return l.Web != nil })
	path := "/api/login/native?id=" + l.ID + "&requestId=" + l.Web.ID
	if w := loginRequest(t, s, "GET", path, "", false); w.Code != 403 {
		t.Fatal("browser could read native login spec", w.Code)
	}
	if w := loginRequest(t, s, "GET", path, "", true); w.Code != 200 || !strings.Contains(w.Body.String(), "cookiesOf") {
		t.Fatal(w.Code, w.Body)
	}
	body := `{"id":"` + l.ID + `","requestId":"` + l.Web.ID + `","cookie":"SID=secret; HSID=private"}`
	if w := loginRequest(t, s, "POST", "/api/login/native", strings.Replace(body, "HSID=private", "HSID=", 1), true); w.Code != 400 {
		t.Fatal("incomplete cookies accepted", w.Code)
	}
	if w := loginRequest(t, s, "POST", "/api/login/native", body, false); w.Code != 403 {
		t.Fatal("browser submitted cookies")
	}
	if w := loginRequest(t, s, "POST", "/api/login/native", body, true); w.Code != 200 {
		t.Fatal(w.Body)
	}
	waitLogin(t, s, func(l Login) bool { return l.State == "complete" })
	public := loginRequest(t, s, "GET", "/api/login", "", false).Body.String()
	if strings.Contains(public, "secret") || strings.Contains(public, "private") || strings.Contains(public, "cookie") {
		t.Fatal("credential leaked", public)
	}
	p, _ := s.sources.Get("fixture")
	a, e := p.Account()
	if e != nil || a == nil || a.Name != "TV" {
		t.Fatal(a, e)
	}
	other := loginFixture(t, cookieLogin)
	op, _ := other.sources.Get("fixture")
	oa, e := op.Account()
	if e != nil || oa != nil {
		t.Fatal("source cookie crossed instance", oa, e)
	}
	if w := loginRequest(t, s, "POST", "/api/login/native", body, true); w.Code != 409 {
		t.Fatal("late callback accepted")
	}
}
func TestCancelledWebLoginRejectsOldResultsAndPreservesNewSession(t *testing.T) {
	s := loginFixture(t, cookieLogin)
	loginRequest(t, s, "POST", "/api/login/fixture", "{}", true)
	old := waitLogin(t, s, func(l Login) bool { return l.Web != nil })
	s.cancelLogin(old.ID)
	loginRequest(t, s, "POST", "/api/login/fixture", "{}", true)
	fresh := waitLogin(t, s, func(l Login) bool { return l.Web != nil && l.ID != old.ID })
	s.cancelLogin(old.ID)
	body, _ := json.Marshal(map[string]string{"id": old.ID, "requestId": old.Web.ID, "cookie": "SID=old; HSID=old"})
	if w := loginRequest(t, s, "POST", "/api/login/native", string(body), true); w.Code != 409 {
		t.Fatal("old result accepted")
	}
	now := waitLogin(t, s, func(l Login) bool { return l.ID == fresh.ID })
	if now.State != "waiting" {
		t.Fatal("old cancellation killed new login")
	}
	s.cancelLogin(fresh.ID)
}
func TestOAuthCallbackIsLoopbackBoundAndCancelReleasesPort(t *testing.T) {
	s := loginFixture(t, `export async function signIn(){host.openURL('https://accounts.example.com/authorize?state=random');const q=await host.waitForRedirect({port:0,path:'/cb',timeout:5000});if(q.state!=='random')throw Error('state mismatch');return {id:q.code,name:'OAuth'};}`)
	loginRequest(t, s, "POST", "/api/login/fixture", "{}", true)
	l := waitLogin(t, s, func(l Login) bool { return l.Web != nil && l.Web.Callback != "" })
	if !strings.HasPrefix(l.Web.Callback, "http://127.0.0.1:") {
		t.Fatal(l.Web)
	}
	res, e := http.Get(l.Web.Callback + "?code=token&state=random")
	if e != nil {
		t.Fatal(e)
	}
	res.Body.Close()
	waitLogin(t, s, func(l Login) bool { return l.State == "complete" })
	loginRequest(t, s, "POST", "/api/login/fixture", "{}", true)
	l = waitLogin(t, s, func(l Login) bool { return l.Web != nil && l.Web.Callback != "" })
	s.cancelLogin(l.ID)
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		res, e = http.Get(l.Web.Callback + "?code=late")
		if e != nil {
			return
		}
		res.Body.Close()
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatal("cancelled callback listener is still open")
}

func TestConcurrentLoginsKeepTheirOwnHostCallbacks(t *testing.T) {
	a := loginFixture(t, cookieLogin+` export function saved(){return host.storage.get('cookie');}`)
	b := loginFixture(t, cookieLogin+` export function saved(){return host.storage.get('cookie');}`)
	loginRequest(t, a, "POST", "/api/login/fixture", "{}", true)
	loginRequest(t, b, "POST", "/api/login/fixture", "{}", true)
	al := waitLogin(t, a, func(l Login) bool { return l.Web != nil })
	bl := waitLogin(t, b, func(l Login) bool { return l.Web != nil })
	submit := func(s *Server, l Login, cookie string) *httptest.ResponseRecorder {
		body, _ := json.Marshal(map[string]string{"id": l.ID, "requestId": l.Web.ID, "cookie": cookie})
		return loginRequest(t, s, "POST", "/api/login/native", string(body), true)
	}
	if w := submit(b, al, "SID=wrong; HSID=wrong"); w.Code != 409 {
		t.Fatal("cross-instance callback accepted")
	}
	for _, test := range []struct {
		s      *Server
		l      Login
		cookie string
	}{{a, al, "SID=first; HSID=first"}, {b, bl, "SID=second; HSID=second"}} {
		if w := submit(test.s, test.l, test.cookie); w.Code != 200 {
			t.Fatal(w.Code, w.Body)
		}
		waitLogin(t, test.s, func(l Login) bool { return l.State == "complete" })
		p, _ := test.s.sources.Get("fixture")
		raw, err := p.CallExport("saved", nil)
		if err != nil || string(raw) != `"`+test.cookie+`"` {
			t.Fatal("cookie crossed instances", string(raw), err)
		}
	}
}
func TestWebLoginTimeoutReportsFailureAndBlocksUpdateUntilItEnds(t *testing.T) {
	s := loginFixture(t, cookieLogin)
	loginRequest(t, s, "POST", "/api/login/fixture", "{}", true)
	waitLogin(t, s, func(l Login) bool { return l.Web != nil })
	if release, err := s.sources.GuardUpdate("fixture"); err == nil {
		release()
		t.Fatal("active login allowed update")
	}
	s.mu.Lock()
	s.loginSession.cancel()
	s.mu.Unlock()
	l := waitLogin(t, s, func(l Login) bool { return l.State == "failed" })
	if l.Web != nil {
		t.Fatal("failed login retained a native request")
	}
	if release, err := s.sources.GuardUpdate("fixture"); err != nil {
		t.Fatal(err)
	} else {
		release()
	}
}
