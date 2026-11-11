package plugin

import "context"

// SignInHost belongs to one installed instance and one login session.
// Never route account callbacks through the package-wide desktop defaults.
type SignInHost struct {
	OpenURL         func(string) error
	WebSignIn       func(WebSignIn) (string, error)
	WaitForRedirect func(Redirect) (map[string]any, error)
}

type Redirect struct {
	Port    int    `json:"port"`
	Path    string `json:"path"`
	Timeout int64  `json:"timeout"`
	Page    string `json:"page"`
}

func (p *Plugin) SetSignInHost(host *SignInHost) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.signInHost = host
}

func (p *Plugin) loginHost() *SignInHost {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.signInHost
}

// AwaitRedirect cancels the loopback listener with its owning login session.
func AwaitRedirect(ctx context.Context, o Redirect, ready func(string)) (map[string]any, error) {
	return awaitRedirectContext(ctx, o, ready)
}
