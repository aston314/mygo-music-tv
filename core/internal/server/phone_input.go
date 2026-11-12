package server

import (
	"errors"
	"net/http"
	"strconv"

	"mygo-music-tv/core/internal/phoneinput"
	"rsc.io/qr"
)

func (s *Server) phoneInputRoutes() {
	s.mux.HandleFunc("POST /api/input-session", func(w http.ResponseWriter, r *http.Request) {
		var q phoneinput.Request
		if !decode(w, r, &q) {
			return
		}
		view, err := s.phoneInput.Start(q)
		if err != nil {
			failure(w, 422, err)
			return
		}
		respond(w, view)
	})
	s.mux.HandleFunc("GET /api/input-session", func(w http.ResponseWriter, r *http.Request) {
		view, ok := s.phoneInput.Status(r.URL.Query().Get("id"))
		if !ok {
			failure(w, 410, errors.New("扫码连接已失效，请重新扫码"))
			return
		}
		respond(w, view)
	})
	s.mux.HandleFunc("DELETE /api/input-session", func(w http.ResponseWriter, r *http.Request) {
		id := r.URL.Query().Get("id")
		before, _ := strconv.ParseInt(r.URL.Query().Get("before"), 10, 64)
		if id == "" && before <= 0 {
			failure(w, 400, errors.New("扫码输入请求无效"))
			return
		}
		s.phoneInput.Cancel(id, before)
		respond(w, map[string]bool{"ok": true})
	})
	s.mux.HandleFunc("GET /api/input-session/qr", func(w http.ResponseWriter, r *http.Request) {
		view, ok := s.phoneInput.Status(r.URL.Query().Get("id"))
		if !ok || view.State == "expired" {
			http.NotFound(w, r)
			return
		}
		code, err := qr.Encode(view.URL, qr.M)
		if err != nil {
			w.WriteHeader(422)
			return
		}
		w.Header().Set("Content-Type", "image/png")
		_, _ = w.Write(code.PNG())
	})
}
