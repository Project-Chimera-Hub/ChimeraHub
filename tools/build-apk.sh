#!/usr/bin/env bash
#
# One site, one APK.
#
#   tools/build-apk.sh          → apk/mindbuild-debug.apk
#
# A new version is this command again. There is no app source to update: the
# APK is tools/build-site.mjs's output in a WebView, so rebuilding the site is
# rebuilding the app, and everything below this line is wrapping.
#
# WHAT THE APK IS NOT
# -------------------
# It is not a browser pointed at gagafutzi.github.io. The whole site is copied
# inside, so it runs with the network off — which is the same promise the
# archive makes about running in five years from a USB stick, and it is worth
# more on a phone than anywhere else.
#
# It is also not gated. The build sets APK=1, which puts the gate-free hub at
# the root: on a phone there is no daemon to answer 127.0.0.1 and no screen for
# one to hold, so the heartbeat and the Gate card would be furniture.
#
# WHAT YOU NEED
# -------------
# A JDK (17 or newer) and an Android SDK, with ANDROID_HOME pointing at it.
# Everything else is fetched by npm. If you have neither, do not install them:
# push a tag, or run the "Build APK" workflow from the Actions tab, and let
# GitHub's runners — which carry both already — hand you the file.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

root="$PWD"
out="$root/apk"

command -v node >/dev/null || { echo "no node" >&2; exit 1; }
command -v java >/dev/null || { echo "no java — see WHAT YOU NEED at the top of this file" >&2; exit 1; }
: "${ANDROID_HOME:=${ANDROID_SDK_ROOT:-}}"
[ -n "$ANDROID_HOME" ] || { echo "ANDROID_HOME is unset — see WHAT YOU NEED at the top of this file" >&2; exit 1; }
export ANDROID_HOME

echo "── [1/5] the site, built for a WebView at the root"
APK=1 BASE=/ node tools/build-site.mjs

echo "── [2/5] staged as the app's web directory"
rm -rf tools/apk/www
cp -r dist tools/apk/www

cd tools/apk

echo "── [3/5] capacitor"
npm install --no-audit --no-fund --silent
# The android/ project is generated, not checked in: it is output of this
# config the same way dist/ is output of the build, and the one thing worse
# than regenerating it is a hand-edited copy drifting from the config.
[ -d android ] || npx --yes cap add android
npx --yes cap sync android

echo "── [4/5] icon and splash, from shell/favicon.svg"
npx --yes capacitor-assets generate --android

echo "── [5/5] gradle"
cd android
./gradlew --no-daemon assembleDebug

mkdir -p "$out"
cp app/build/outputs/apk/debug/app-debug.apk "$out/mindbuild-debug.apk"
echo
echo "→ $out/mindbuild-debug.apk"
echo
echo "It is signed with the debug key, which is enough to install it on your"
echo "own phone and not enough for the Play Store. Enable installing from"
echo "unknown sources, copy it across, tap it."
