package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"mygo-music-tv/core/internal/server"
)

func main() {
	port := flag.Int("port", 0, "loopback port, 0 chooses a free port")
	data := flag.String("data-dir", ".data", "private data directory")
	mode := flag.String("mode", "real", "real, fixture, empty, error, loading")
	parent := flag.Int("parent-pid", 0, "parent PID orphan guard")
	ready := flag.String("ready-file", "", "atomic readiness file")
	flag.Parse()
	if *mode != "real" && *mode != "fixture" && *mode != "empty" && *mode != "error" && *mode != "loading" {
		panic("invalid mode")
	}
	if e := os.MkdirAll(*data, 0700); e != nil {
		panic(e)
	}
	token := os.Getenv("MYGO_INSTANCE_TOKEN")
	s, e := server.New(*data, *mode, token)
	if e != nil {
		panic(e)
	}
	ln, e := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", *port))
	if e != nil {
		panic(e)
	}
	address := "http://" + ln.Addr().String()
	h := &http.Server{Handler: s, ReadHeaderTimeout: 10 * time.Second, IdleTimeout: 60 * time.Second}
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	if *parent > 0 {
		go func() {
			ticker := time.NewTicker(time.Second)
			defer ticker.Stop()
			for {
				select {
				case <-ctx.Done():
					return
				case <-ticker.C:
					if os.Getppid() != *parent {
						cancel()
						return
					}
				}
			}
		}()
	}
	if *ready != "" {
		b, _ := json.Marshal(map[string]string{"url": address, "token": s.Token()})
		if e = os.MkdirAll(filepath.Dir(*ready), 0700); e != nil {
			panic(e)
		}
		if e = os.WriteFile(*ready+".part", b, 0600); e != nil {
			panic(e)
		}
		if e = os.Rename(*ready+".part", *ready); e != nil {
			panic(e)
		}
		defer os.Remove(*ready)
	}
	fmt.Printf("MyGo Music TV 0.1.0 | mode=%s | %s/?token=%s\n", *mode, address, s.Token())
	go func() {
		if e := h.Serve(ln); e != nil && e != http.ErrServerClosed {
			fmt.Fprintln(os.Stderr, e)
			cancel()
		}
	}()
	<-ctx.Done()
	shutdown, done := context.WithTimeout(context.Background(), 5*time.Second)
	defer done()
	_ = h.Shutdown(shutdown)
	s.Close()
}
