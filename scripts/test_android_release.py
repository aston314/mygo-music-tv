import unittest

from android_release import release_tag, verify_badging, verify_signature


class AndroidReleaseTests(unittest.TestCase):
    app = {
        "applicationId": "dev.aston.mygo.music.tv",
        "displayName": "MyGo Music TV",
        "versionName": "0.1.0",
        "versionCode": 1,
        "minSdk": 23,
    }
    badging = """package: name='dev.aston.mygo.music.tv' versionCode='1' versionName='0.1.0' platformBuildVersionName='15'
sdkVersion:'23'
application-label:'MyGo Music TV'
"""
    certificate = "ab" * 32
    signatures = """Verified using v1 scheme (JAR signing): true
Verified using v2 scheme (APK Signature Scheme v2): true
Signer #1 certificate SHA-256 digest: """ + certificate + "\n"

    def test_only_main_or_matching_version_tag_can_release(self):
        self.assertEqual(release_tag(self.app, "workflow_dispatch", "refs/heads/main"), "v0.1.0")
        self.assertEqual(release_tag(self.app, "push", "refs/tags/v0.1.0"), "v0.1.0")
        for event, ref in (
            ("workflow_dispatch", "refs/heads/codex/feature"),
            ("push", "refs/tags/v0.2.0"),
            ("push", "refs/heads/main"),
            ("pull_request", "refs/heads/main"),
        ):
            with self.subTest(event=event, ref=ref), self.assertRaises(ValueError):
                release_tag(self.app, event, ref)

    def test_release_apk_identity_and_non_debuggable_build_are_required(self):
        verify_badging(self.badging, self.app)
        for text in (
            self.badging.replace("versionCode='1'", "versionCode='2'"),
            self.badging.replace("dev.aston.mygo.music.tv", "other.app"),
            self.badging.replace("sdkVersion:'23'", "sdkVersion:'26'"),
            self.badging.replace("MyGo Music TV", "Other"),
            self.badging + "application-debuggable\n",
        ):
            with self.subTest(badging=text), self.assertRaises(ValueError):
                verify_badging(text, self.app)

    def test_release_requires_expected_certificate_and_old_android_signature(self):
        verify_signature(self.signatures, self.certificate)
        for output, expected in (
            (self.signatures, "cd" * 32),
            (self.signatures, ""),
            (self.signatures.replace("v1 scheme (JAR signing): true", "v1 scheme (JAR signing): false"), self.certificate),
            (self.signatures.replace("v2 scheme (APK Signature Scheme v2): true", "v2 scheme (APK Signature Scheme v2): false"), self.certificate),
            (self.signatures + "Signer #2 certificate SHA-256 digest: " + self.certificate + "\n", self.certificate),
        ):
            with self.subTest(output=output, expected=expected), self.assertRaises(ValueError):
                verify_signature(output, expected)


if __name__ == "__main__":
    unittest.main()
