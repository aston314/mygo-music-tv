#!/usr/bin/env python3
import json
import pathlib
import sys
import zipfile

root = pathlib.Path(__file__).resolve().parent.parent
app = json.loads((root / 'app.json').read_text())
with zipfile.ZipFile(sys.argv[1]) as apk:
    for abi in app['abis']:
        name = f'lib/{abi}/libmygocore.so'
        assert apk.getinfo(name).file_size > 1_000_000, name
        assert apk.read(name)[:4] == b'\x7fELF', name
    print('APK contains all three Go core executables.')
