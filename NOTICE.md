# Attribution

The Go music models, plugin host/installer, lyrics parser, translations and demo
plugin under core/ are adapted from egoist/mygo-music v0.1.22, commit
1af0d8efd77fdf630c27cfc635f12e9cb089ce10 (AGPL-3.0).

This project replaces the desktop UI/audio backend with an Android TV shell,
HTTP service and WebView UI, omits the local music library, and adapts the plugin
host for instance isolation and platform capability boundaries. It is a separate
project and is not endorsed by the upstream authors.

Go dependencies and their licenses are preserved in vendor/. moejs alpha.11 has
the documented 32-bit URL comparison patch (docs/patches/moejs-arm32.patch).

Third-party music plugins are downloaded only when selected. Their authors,
licenses, accounts and available service features remain their own.
