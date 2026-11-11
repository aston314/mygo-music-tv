package product

import (
	_ "embed"
	"encoding/json"
)

//go:embed app.json
var manifest []byte

type Config struct {
	SupportedLocales           []string `json:"supportedLocales"`
	DefaultLocale              string   `json:"defaultLocale"`
	DisplayName                string   `json:"displayName"`
	ApplicationID              string   `json:"applicationId"`
	VersionName                string   `json:"versionName"`
	VersionCode                int      `json:"versionCode"`
	PluginCatalogURL           string   `json:"pluginCatalogUrl"`
	PluginCompatibilityVersion string   `json:"pluginCompatibilityVersion"`
}

func App() Config {
	var c Config
	if err := json.Unmarshal(manifest, &c); err != nil {
		panic(err)
	}
	return c
}
