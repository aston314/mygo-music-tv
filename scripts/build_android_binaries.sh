#!/usr/bin/env bash
set -euo pipefail
MUSIC_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MUSIC_NDK="${ANDROID_NDK_HOME:-${ANDROID_NDK_ROOT:-}}"
if [[ -z "$MUSIC_NDK" && -n "${ANDROID_HOME:-}" ]]; then MUSIC_NDK="$ANDROID_HOME/ndk/27.2.12479018"; fi
if [[ ! -d "$MUSIC_NDK/toolchains/llvm/prebuilt" ]]; then echo 'Set ANDROID_NDK_HOME to NDK 27.2.12479018' >&2; exit 1; fi
case "$(uname -s)" in Darwin) MUSIC_HOST=darwin-x86_64;; Linux) MUSIC_HOST=linux-x86_64;; *) exit 1;; esac
MUSIC_CC="$MUSIC_NDK/toolchains/llvm/prebuilt/$MUSIC_HOST/bin"
cd "$MUSIC_ROOT"
for MUSIC_ABI in arm64-v8a armeabi-v7a x86_64; do
  case "$MUSIC_ABI" in
    arm64-v8a) MUSIC_ARCH=arm64; MUSIC_TARGET=aarch64-linux-android23;;
    armeabi-v7a) MUSIC_ARCH=arm; MUSIC_TARGET=armv7a-linux-androideabi23;;
    x86_64) MUSIC_ARCH=amd64; MUSIC_TARGET=x86_64-linux-android23;;
  esac
  mkdir -p "android/app/src/main/jniLibs/$MUSIC_ABI"
  CGO_ENABLED=1 GOOS=android GOARCH="$MUSIC_ARCH" GOARM=7 CC="$MUSIC_CC/$MUSIC_TARGET-clang" \
    go build -mod=vendor -trimpath -buildmode=pie -ldflags='-s -w' -o "android/app/src/main/jniLibs/$MUSIC_ABI/libmygocore.so" ./core/cmd/music-tv
done
