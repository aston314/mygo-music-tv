#!/usr/bin/env python3
"""Mirror an allowlisted, verified signed release; never upload source files."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
APP = json.loads((ROOT / 'app.json').read_text())
REPOSITORY = APP['publicReleaseRepository']


def digest(path):
    checksum = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            checksum.update(chunk)
    return checksum.hexdigest()


def gh(*args, payload=None, required=True):
    command = ['gh', *args]
    if payload is not None:
        command += ['--input', '-']
    result = subprocess.run(command, input=None if payload is None else json.dumps(payload),
                            capture_output=True, text=True, check=False)
    if required and result.returncode:
        raise RuntimeError(result.stderr.strip() or 'GitHub publication failed')
    return result


def api(path, method=None, **kwargs):
    return json.loads(gh('api', path, *([] if method is None else ['--method', method]), **kwargs).stdout)


def verify_bundle(directory):
    update = directory / 'update.json'
    manifest = json.loads(update.read_text())
    version = manifest['version_name']
    if not isinstance(version, str) or not re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?', version):
        raise ValueError('Invalid version')
    if manifest['schema'] != 1 or manifest['package_name'] != APP['applicationId']:
        raise ValueError('Foreign update manifest')
    if type(manifest['version_code']) is not int or manifest['version_code'] <= 0 or manifest['min_sdk'] < APP['minSdk']:
        raise ValueError('Invalid versionCode or SDK')
    apk = directory / f'mygo-music-tv-{version}.apk'
    if not 0 < apk.stat().st_size <= 100 * 1024 * 1024 or apk.stat().st_size != manifest['size'] or digest(apk) != manifest['sha256']:
        raise ValueError('APK differs from manifest')
    expected = f'https://github.com/{REPOSITORY}/releases/download/v{version}/{apk.name}'
    if manifest['download_url'] != expected:
        raise ValueError('Invalid public APK URL')
    if not re.fullmatch('[a-f0-9]{64}', manifest.get('certificate_sha256', '')):
        raise ValueError('Missing verified signing fingerprint')
    sums = directory / 'SHA256SUMS.txt'
    entries = {}
    for line in sums.read_text().splitlines():
        parts = line.split()
        if len(parts) != 2 or not re.fullmatch('[a-f0-9]{64}', parts[0]) or parts[1] in entries:
            raise ValueError('Invalid checksum entries')
        entries[parts[1]] = parts[0]
    if entries != {p.name: digest(p) for p in (apk, update)}:
        raise ValueError('Checksums differ from allowlisted files')
    return manifest, (apk, update, sums)


def may_update(previous, manifest):
    if previous is None:
        return True
    if type(previous['version_code']) is not int:
        raise ValueError('Invalid previous versionCode')
    if previous['version_code'] > manifest['version_code']:
        return False
    if previous['version_code'] == manifest['version_code'] and (
            previous['sha256'] != manifest['sha256'] or previous['version_name'] != manifest['version_name']):
        raise ValueError('Refusing to replace an existing version with different bytes or identity')
    return True


def read_channel():
    result = gh('api', f'repos/{REPOSITORY}/contents/update.json', required=False)
    if result.returncode == 0:
        value = json.loads(result.stdout)
        return value, json.loads(base64.b64decode(value['content']))
    if '404' not in result.stderr:
        raise RuntimeError(result.stderr.strip() or 'Cannot read update channel')
    return None, None


def verify_assets(release, files):
    assets = {asset['name']: asset for asset in release['assets']}
    for path in files:
        asset = assets.get(path.name)
        if asset is None or asset.get('digest') != 'sha256:' + digest(path) or asset.get('size') != path.stat().st_size:
            raise ValueError('Published asset differs; preserving it: ' + path.name)


def check_access():
    repo = api(f'repos/{REPOSITORY}')
    if repo['private'] or repo['default_branch'] != 'main':
        raise ValueError('Download repository must be public with main as default branch')
    # A fixed, unreferenced Git blob checks actual Contents write permission
    # without changing branches, download metadata, releases or their assets.
    content = b'Music release publishing access check\n'
    expected = hashlib.sha1(b'blob ' + str(len(content)).encode() + b'\0' + content).hexdigest()
    result = api(f'repos/{REPOSITORY}/git/blobs', method='POST', payload={
        'content': content.decode(), 'encoding': 'utf-8'})
    if result.get('sha') != expected:
        raise ValueError('Download repository write verification failed')
    print('Download repository Contents write access verified; published files unchanged')


def publish(directory, notes):
    manifest, files = verify_bundle(directory)
    repo = api(f'repos/{REPOSITORY}')
    if repo['private'] or repo['default_branch'] != 'main':
        raise ValueError('Download repository must be public with main as default branch')
    may_update(read_channel()[1], manifest)
    tag = 'v' + manifest['version_name']
    result = gh('api', f'repos/{REPOSITORY}/releases/tags/{tag}', required=False)
    if result.returncode == 0:
        release = json.loads(result.stdout)
    elif '404' in result.stderr:
        release = next((r for r in api(f'repos/{REPOSITORY}/releases?per_page=100') if r['tag_name'] == tag), None)
    else:
        raise RuntimeError(result.stderr.strip() or 'Cannot read release')
    if release is not None:
        if any(a['name'] not in {p.name for p in files} for a in release['assets']):
            raise ValueError('Unexpected public assets; preserving release')
        for path in files:
            asset = next((a for a in release['assets'] if a['name'] == path.name), None)
            if asset is not None:
                verify_assets({'assets': [asset]}, (path,))
    else:
        release = api(f'repos/{REPOSITORY}/releases', payload={
            'tag_name': tag, 'target_commitish': 'main', 'draft': True,
            'name': APP['displayName'] + ' ' + tag, 'body': notes.read_text()})
    if release['draft']:
        existing = {a['name'] for a in release['assets']}
        for path in files:
            if path.name in existing:
                continue
            endpoint = f'https://uploads.github.com/repos/{REPOSITORY}/releases/{release["id"]}/assets?name={quote(path.name)}'
            asset = json.loads(gh('api', '--method', 'POST', endpoint,
                                  '--header', 'Content-Type: application/octet-stream', '--input', str(path)).stdout)
            verify_assets({'assets': [asset]}, (path,))
        verify_assets(api(f'repos/{REPOSITORY}/releases/{release["id"]}'), files)
        release = api(f'repos/{REPOSITORY}/releases/{release["id"]}', method='PATCH', payload={'draft': False})
    verify_assets(release, files)
    if release['draft']:
        raise RuntimeError('Release is still a draft; channel was not changed')
    old, previous = read_channel()
    if not may_update(previous, manifest):
        print('Newer update channel preserved')
        return
    content = (directory / 'update.json').read_bytes()
    if old is None or base64.b64decode(old['content']) != content:
        payload = {'message': 'Publish ' + APP['displayName'] + ' ' + tag, 'content': base64.b64encode(content).decode()}
        if old is not None:
            payload['sha'] = old['sha']
        api(f'repos/{REPOSITORY}/contents/update.json', method='PUT', payload=payload)
    print(f'Published verified downloads: https://github.com/{REPOSITORY}/releases/tag/{tag}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--directory', type=Path)
    parser.add_argument('--notes', type=Path)
    parser.add_argument('--verify-only', action='store_true')
    parser.add_argument('--check-access', action='store_true')
    args = parser.parse_args()
    if args.check_access:
        check_access()
    elif args.directory is None or not args.verify_only and args.notes is None:
        parser.error('--directory and --notes are required for publication')
    elif args.verify_only:
        verify_bundle(args.directory)
        print('Public bundle verified')
    else:
        publish(args.directory, args.notes)
