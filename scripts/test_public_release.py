import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from publish_public_release import APP, REPOSITORY, check_access, may_update, verify_bundle


class PublicReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.apk = self.root / 'mygo-music-tv-0.1.4.apk'
        self.apk.write_bytes(b'signed APK fixture')
        self.manifest = {
            'schema': 1, 'package_name': APP['applicationId'], 'version_name': '0.1.4',
            'version_code': 5, 'min_sdk': 23, 'certificate_sha256': 'ab' * 32,
            'sha256': self.sha(self.apk), 'size': self.apk.stat().st_size,
            'download_url': f'https://github.com/{REPOSITORY}/releases/download/v0.1.4/{self.apk.name}',
        }
        self.save()

    def sha(self, path):
        return hashlib.sha256(path.read_bytes()).hexdigest()

    def save(self):
        update = self.root / 'update.json'
        update.write_text(json.dumps(self.manifest))
        (self.root / 'SHA256SUMS.txt').write_text(''.join(self.sha(p) + '  ' + p.name + '\n' for p in (self.apk, update)))

    def test_only_verified_apk_manifest_and_checksums_are_selected(self):
        (self.root / 'private-source.zip').write_bytes(b'never upload')
        _, files = verify_bundle(self.root)
        self.assertEqual({p.name for p in files}, {self.apk.name, 'update.json', 'SHA256SUMS.txt'})

    def test_bad_bytes_cannot_be_published(self):
        self.apk.write_bytes(b'tampered')
        with self.assertRaises(ValueError):
            verify_bundle(self.root)

    def test_private_foreign_or_mutable_urls_are_rejected(self):
        original = self.manifest['download_url']
        for url in [original.replace(REPOSITORY, APP['privateRepository']),
                    original.replace('github.com', 'github.com.evil.test'),
                    original.replace('download/v0.1.4', 'latest/download')]:
            self.manifest['download_url'] = url
            self.save()
            with self.subTest(url=url), self.assertRaises(ValueError):
                verify_bundle(self.root)

    def test_checksum_allowlist_rejects_extra_files(self):
        sums = self.root / 'SHA256SUMS.txt'
        sums.write_text(sums.read_text() + 'ab' * 32 + '  private-source.zip\n')
        with self.assertRaises(ValueError):
            verify_bundle(self.root)

    def test_public_channel_cannot_downgrade_or_replace_existing_bytes(self):
        self.assertTrue(may_update(None, self.manifest))
        self.assertTrue(may_update(dict(self.manifest), self.manifest))
        self.assertFalse(may_update(dict(self.manifest, version_code=6), self.manifest))
        for old in [dict(self.manifest, sha256='cd' * 32), dict(self.manifest, version_name='0.1.3')]:
            with self.assertRaises(ValueError):
                may_update(old, self.manifest)

    def test_token_check_verifies_actual_writes_without_changing_published_files(self):
        def reply(path, method=None, **kwargs):
            if path == f'repos/{REPOSITORY}':
                return {'private': False, 'default_branch': 'main'}
            self.assertEqual(path, f'repos/{REPOSITORY}/git/blobs')
            self.assertEqual(method, 'POST')
            content = kwargs['payload']['content'].encode()
            return {'sha': hashlib.sha1(b'blob ' + str(len(content)).encode() + b'\0' + content).hexdigest()}
        with patch('publish_public_release.api', side_effect=reply) as request:
            check_access()
            self.assertEqual(request.call_count, 2)

    def test_token_check_stops_before_writing_to_a_private_repository(self):
        with patch('publish_public_release.api', return_value={'private': True, 'default_branch': 'main'}) as request:
            with self.assertRaises(ValueError):
                check_access()
            self.assertEqual(request.call_count, 1)


if __name__ == '__main__':
    unittest.main()
