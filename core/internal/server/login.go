package server

import (
	"context"
	"crypto/subtle"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"

	"mygo-music-tv/core/internal/music"
	"mygo-music-tv/core/internal/plugin"
)

type LoginWeb struct {
	ID       string `json:"id"`
	Kind     string `json:"kind"`
	URL      string `json:"url"`
	Callback string `json:"callback,omitempty"`
}
type Login struct {
	ID      string             `json:"id"`
	Source  string             `json:"source"`
	State   string             `json:"state"`
	Prompt  music.SignInPrompt `json:"prompt"`
	Web     *LoginWeb          `json:"web,omitempty"`
	Message string             `json:"message,omitempty"`
}
type loginReply struct {
	cookie string
	err    error
}
type loginSession struct {
	id       string
	source   string
	p        *plugin.Plugin
	ctx      context.Context
	cancel   context.CancelFunc
	request  *plugin.WebSignIn
	reply    chan loginReply
	callback string
}

func (s *Server) startLogin(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	p, err := s.sources.Get(id)
	if err != nil {
		failure(w, 404, err)
		return
	}
	if !p.Can("signIn") {
		failure(w, 400, music.ErrUnsupported)
		return
	}
	s.mu.Lock()
	if s.login.State == "waiting" || s.loginStopping {
		s.mu.Unlock()
		failure(w, 409, errors.New("请先完成或取消当前登录"))
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	l := &loginSession{id: randomID(), source: id, p: p, ctx: ctx, cancel: cancel}
	s.loginSession = l
	s.login = Login{ID: l.id, Source: id, State: "waiting"}
	p.SetSignInHost(&plugin.SignInHost{
		OpenURL: func(address string) error {
			u, e := url.Parse(address)
			if e != nil || u.User != nil || u.Hostname() == "" || u.Scheme != "https" {
				return errors.New("登录页面需要安全的 HTTPS 地址")
			}
			s.mu.Lock()
			defer s.mu.Unlock()
			if s.loginSession != l || l.ctx.Err() != nil {
				return context.Canceled
			}
			s.login.Web = &LoginWeb{ID: randomID(), Kind: "oauth", URL: address, Callback: l.callback}
			return nil
		},
		WebSignIn: func(o plugin.WebSignIn) (string, error) { return s.awaitWebLogin(l, o) },
		WaitForRedirect: func(o plugin.Redirect) (map[string]any, error) {
			// Plugins own service-specific OAuth state and PKCE validation.
			o.Page = "登录回调已收到，请返回 MyGo Music TV。"
			return plugin.AwaitRedirect(l.ctx, o, func(address string) {
				s.mu.Lock()
				defer s.mu.Unlock()
				if s.loginSession == l && l.ctx.Err() == nil {
					l.callback = address
					if s.login.Web != nil {
						x := *s.login.Web
						x.Callback = address
						s.login.Web = &x
					}
				}
			})
		},
	})
	p.OnSignInPrompt(func(prompt music.SignInPrompt) {
		s.mu.Lock()
		defer s.mu.Unlock()
		if s.loginSession == l && l.ctx.Err() == nil {
			s.login.Prompt = prompt
		}
	})
	s.wg.Add(1)
	s.mu.Unlock()
	go func() {
		defer s.wg.Done()
		_, err := p.SignIn()
		s.mu.Lock()
		defer s.mu.Unlock()
		if s.loginSession != l {
			return
		}
		cancel()
		l.request = nil
		s.login.Web = nil
		if err != nil {
			s.login.State = "failed"
			s.login.Message = "登录未完成，请重试或检查音乐源设置"
		} else {
			s.login.State = "complete"
		}
	}()
	respond(w, map[string]string{"id": l.id})
}

func (s *Server) awaitWebLogin(l *loginSession, o plugin.WebSignIn) (string, error) {
	s.mu.Lock()
	if s.loginSession != l || l.ctx.Err() != nil {
		s.mu.Unlock()
		return "", context.Canceled
	}
	if l.request != nil {
		s.mu.Unlock()
		return "", errors.New("登录页面仍在等待")
	}
	l.request = &o
	l.reply = make(chan loginReply, 1)
	s.login.Web = &LoginWeb{ID: randomID(), Kind: "cookies", URL: o.URL}
	s.mu.Unlock()
	select {
	case reply := <-l.reply:
		s.mu.Lock()
		if s.loginSession == l {
			l.request = nil
			s.login.Web = nil
		}
		s.mu.Unlock()
		return reply.cookie, reply.err
	case <-l.ctx.Done():
		return "", l.ctx.Err()
	}
}

func (s *Server) cancelLogin(id string) {
	s.mu.Lock()
	l := s.loginSession
	if l == nil || id != "" && id != l.id {
		s.mu.Unlock()
		return
	}
	waiting := s.login.State == "waiting"
	s.loginSession = nil
	l.cancel()
	l.request = nil
	s.login.Web = nil
	if waiting {
		s.login.State = "cancelled"
		s.loginStopping = true
	}
	s.mu.Unlock()
	if waiting {
		l.p.Close()
		s.mu.Lock()
		s.loginStopping = false
		s.mu.Unlock()
	}
}

// Credentials are native-only: neither the app's JS nor the remote page can
// fetch/submit cookies with the browser's HttpOnly session cookie.
func (s *Server) nativeLogin(w http.ResponseWriter, r *http.Request) {
	if subtle.ConstantTimeCompare([]byte(r.Header.Get("Authorization")), []byte("Bearer "+s.token)) != 1 {
		failure(w, 403, errors.New("仅原生登录窗口可访问"))
		return
	}
	var q struct {
		ID        string `json:"id"`
		RequestID string `json:"requestId"`
		Cookie    string `json:"cookie"`
		Error     string `json:"error"`
	}
	if r.Method == "POST" {
		if !decode(w, r, &q) {
			return
		}
	} else {
		q.ID = r.URL.Query().Get("id")
		q.RequestID = r.URL.Query().Get("requestId")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	l := s.loginSession
	if l == nil || l.id != q.ID || l.ctx.Err() != nil || s.login.State != "waiting" || s.login.Web == nil || s.login.Web.ID != q.RequestID {
		failure(w, 409, errors.New("此登录会话已失效"))
		return
	}
	if r.Method == "GET" {
		respond(w, struct {
			Web     *LoginWeb         `json:"web"`
			Request *plugin.WebSignIn `json:"request,omitempty"`
		}{s.login.Web, l.request})
		return
	}
	if l.request == nil {
		failure(w, 400, errors.New("此会话不接收 Cookie"))
		return
	}
	reply := loginReply{cookie: q.Cookie}
	if q.Error != "" {
		reply = loginReply{err: errors.New("登录窗口未完成授权")}
	} else if !validLoginCookie(q.Cookie, l.request.Until) {
		failure(w, 400, errors.New("登录信息尚不完整"))
		return
	}
	select {
	case l.reply <- reply:
		l.request = nil
	default:
		failure(w, 409, errors.New("登录结果已提交"))
		return
	}
	respond(w, map[string]bool{"ok": true})
}
func validLoginCookie(value string, until []string) bool {
	if value == "" || len(value) > 64<<10 || strings.ContainsAny(value, "\r\n\x00") {
		return false
	}
	r := http.Request{Header: http.Header{"Cookie": []string{value}}}
	for _, key := range until {
		c, e := r.Cookie(key)
		if e != nil || c.Value == "" {
			return false
		}
	}
	return len(until) > 0
}
