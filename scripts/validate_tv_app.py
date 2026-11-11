#!/usr/bin/env python3
"""Check product boundaries before packaging; no signing or release side effects."""
import json
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parent.parent
app = json.loads((root / 'app.json').read_text())
assert app['canvas'] == {'width': 1280, 'height': 720}
assert app['minSdk'] == 23
assert set(app['abis']) == {'arm64-v8a', 'armeabi-v7a', 'x86_64'}
assert app['versionCode'] > 0
for name in ('android', 'core', 'ui', 'scripts', 'tests', '.github/workflows'):
    assert (root / name).is_dir(), name
assert not (root / 'core/internal/local').exists()
assert 'mygo/audio' not in (root / 'go.mod').read_text()
assert 'START_NOT_STICKY' in (root / 'android/app/src/main/java/dev/aston/mygo/music/tv/CoreService.java').read_text()
assert 'actions/upload-artifact' not in (root / '.github/workflows/ci.yml').read_text()
print('Product configuration and layer boundaries checked.')
