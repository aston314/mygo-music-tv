package examples

import "embed"

//go:embed demo-plugin/* demo-plugin/locales/*
var Files embed.FS
