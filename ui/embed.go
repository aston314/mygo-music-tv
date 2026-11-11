package ui

import "embed"

//go:embed index.html app.css app.js platform.js i18n.js locales/*.js
var Files embed.FS
