#!/usr/bin/env python3
"""Prepare signing inputs and package only a verified Android release APK."""
import argparse
import base64
import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SECRETS = (
    "ANDROID_KEYSTORE_BASE64",
    "ANDROID_KEYSTORE_PASSWORD",
    "ANDROID_KEY_ALIAS",
    "ANDROID_KEY_PASSWORD",
)


def release_tag(app, event, ref):
    version = app["versionName"]
    if not re.fullmatch(r"\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?", version):
        raise ValueError("Invalid versionName in app.json")
    if type(app["versionCode"]) is not int or app["versionCode"] < 1:
        raise ValueError("Invalid versionCode in app.json")
    tag = "v" + version
    if event == "workflow_dispatch":
        if ref != "refs/heads/main":
            raise ValueError("Manual releases must run from main")
    elif event == "push":
        if ref != "refs/tags/" + tag:
            raise ValueError("Release tag must match app.json versionName")
    else:
        raise ValueError("Unsupported release event")
    return tag


def tool_output(command):
    result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        # Tools may include signing inputs in their error output. Keep it private.
        raise ValueError(pathlib.Path(command[0]).name + " failed; check release configuration")
    return result.stdout


def app_config():
    return json.loads((ROOT / "app.json").read_text())


def preflight():
    app = app_config()
    tag = release_tag(app, os.environ.get("GITHUB_EVENT_NAME"), os.environ.get("GITHUB_REF"))
    if os.environ.get("GITHUB_REPOSITORY") != app["privateRepository"]:
        raise ValueError("Release repository does not match app.json")
    commit = os.environ.get("GITHUB_SHA", "")
    if not re.fullmatch(r"[0-9a-f]{40}", commit):
        raise ValueError("Missing release commit")
    tool_output(["git", "merge-base", "--is-ancestor", commit, "origin/main"])
    missing = [name for name in SECRETS if not os.environ.get(name, "").strip()]
    if missing:
        raise ValueError("Fill these Actions Secrets before releasing: " + ", ".join(missing))
    try:
        keystore = base64.b64decode("".join(os.environ["ANDROID_KEYSTORE_BASE64"].split()), validate=True)
    except (ValueError, base64.binascii.Error):
        raise ValueError("ANDROID_KEYSTORE_BASE64 is not valid base64") from None
    if not keystore or len(keystore) > 1024 * 1024:
        raise ValueError("Invalid release keystore size")
    path = pathlib.Path(os.environ["RUNNER_TEMP"]) / "mygo-release-keystore.jks"
    path.write_bytes(keystore)
    path.chmod(0o600)
    try:
        certificate = tool_output([
            "keytool", "-exportcert", "-keystore", str(path),
            "-alias", os.environ["ANDROID_KEY_ALIAS"],
            "-storepass:env", "ANDROID_KEYSTORE_PASSWORD",
        ])
    except Exception:
        path.unlink(missing_ok=True)
        raise
    fingerprint = hashlib.sha256(certificate).hexdigest()
    with open(os.environ["GITHUB_ENV"], "a") as env:
        env.write("ANDROID_KEYSTORE_PATH=" + str(path) + "\n")
        env.write("RELEASE_CERTIFICATE_SHA256=" + fingerprint + "\n")
        env.write("RELEASE_TAG=" + tag + "\n")
    print("Release preflight passed: main ancestry, version and signing inputs checked.")


def verify_badging(output, app):
    package = re.search(r"^package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'", output, re.M)
    sdk = re.search(r"^sdkVersion:'(\d+)'", output, re.M)
    label = re.search(r"^application-label:'([^']*)'", output, re.M)
    if not package or package.groups() != (app["applicationId"], str(app["versionCode"]), app["versionName"]):
        raise ValueError("APK package or version does not match app.json")
    if not sdk or int(sdk[1]) != app["minSdk"]:
        raise ValueError("APK minimum SDK does not match app.json")
    if not label or label[1] != app["displayName"]:
        raise ValueError("APK label does not match app.json")
    if re.search(r"^application-debuggable(?:\s|$)", output, re.M):
        raise ValueError("Refusing to publish a debuggable APK")


def verify_signature(output, expected):
    fingerprints = re.findall(r"^Signer #\d+ certificate SHA-256 digest:\s*([0-9a-fA-F]+)\s*$", output, re.M)
    if not re.fullmatch(r"[0-9a-fA-F]{64}", expected or "") or len(fingerprints) != 1 or fingerprints[0].lower() != expected.lower():
        raise ValueError("APK signing certificate does not match the release keystore")
    for scheme in ("v1", "v2"):
        if not re.search(r"^Verified using " + scheme + r" scheme[^:]*: true\s*$", output, re.M):
            raise ValueError("APK must verify with Android v1 and v2 signatures")


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def package(apk):
    app = app_config()
    tag = release_tag(app, os.environ.get("GITHUB_EVENT_NAME"), os.environ.get("GITHUB_REF"))
    build_tools = pathlib.Path(os.environ["ANDROID_HOME"]) / "build-tools/35.0.0"
    verify_badging(tool_output([str(build_tools / "aapt"), "dump", "badging", str(apk)]).decode(), app)
    signatures = tool_output([str(build_tools / "apksigner"), "verify", "--verbose", "--print-certs", str(apk)]).decode()
    fingerprint = os.environ.get("RELEASE_CERTIFICATE_SHA256", "")
    verify_signature(signatures, fingerprint)
    tool_output([sys.executable, str(ROOT / "scripts/verify_apk.py"), str(apk)])
    notes_path = ROOT / "docs/release-notes" / (app["versionName"] + ".md")
    if not notes_path.is_file():
        raise ValueError("Release notes are missing")
    output = ROOT / "build/release"
    output.mkdir(parents=True, exist_ok=True)
    filename = "mygo-music-tv-" + app["versionName"] + ".apk"
    signed = output / filename
    shutil.copyfile(apk, signed)
    manifest = {
        "schema": 1,
        "package_name": app["applicationId"],
        "version_code": app["versionCode"],
        "version_name": app["versionName"],
        "min_sdk": app["minSdk"],
        "size": signed.stat().st_size,
        "sha256": sha256(signed),
        "certificate_sha256": fingerprint.lower(),
        "download_url": "https://github.com/" + app["privateRepository"] + "/releases/download/" + tag + "/" + filename,
        "release_notes": notes_path.read_text(),
    }
    update = output / "update.json"
    update.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    (output / "SHA256SUMS.txt").write_text("".join(sha256(path) + "  " + path.name + "\n" for path in (signed, update)))
    with open(os.environ["GITHUB_ENV"], "a") as env:
        env.write("RELEASE_APK=" + str(signed) + "\n")
        env.write("RELEASE_NOTES=" + str(notes_path) + "\n")
    print("Verified release APK: identity, version, minimum SDK, certificate, signatures and three core ABIs.")
    print("Release signing certificate SHA256: " + fingerprint.lower())


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=("preflight", "package"))
    parser.add_argument("--apk", type=pathlib.Path)
    args = parser.parse_args()
    try:
        if args.action == "preflight":
            preflight()
        elif args.apk:
            package(args.apk)
        else:
            raise ValueError("--apk is required")
    except (ValueError, KeyError, OSError) as error:
        print("Release preparation failed: " + str(error), file=sys.stderr)
        sys.exit(1)
