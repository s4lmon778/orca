#!/bin/bash
# Installs the latest patched Orca build from this fork into /Applications.
# A download made with curl carries no quarantine flag, so macOS does not report the
# ad hoc signed (not notarized) app as "damaged".
set -euo pipefail

url="https://github.com/s4lmon778/orca/releases/latest/download/Orca-patched-macos-arm64.dmg"
if [ "$(uname -m)" != arm64 ]; then
  echo "This build is for Apple Silicon Macs (M1 and later) only." >&2
  exit 1
fi

tmp=$(mktemp -d)
cleanup() { hdiutil detach "$tmp/mnt" -quiet 2>/dev/null || true; rm -rf "$tmp"; }
trap cleanup EXIT

echo "Downloading Orca (about 390 MB)..."
curl -fL --progress-bar -o "$tmp/orca.dmg" "$url"
hdiutil attach "$tmp/orca.dmg" -nobrowse -readonly -quiet -mountpoint "$tmp/mnt"

if pgrep -xq Orca; then
  echo "Quitting Orca..."
  osascript -e 'quit app "Orca"' >/dev/null 2>&1 || true
  for _ in $(seq 1 30); do pgrep -xq Orca || break; sleep 1; done
  if pgrep -xq Orca; then echo "Orca is still running; quit it and run this again." >&2; exit 1; fi
fi

echo "Installing to /Applications/Orca.app..."
rm -rf /Applications/Orca.app
ditto "$tmp/mnt/Orca.app" /Applications/Orca.app
xattr -dr com.apple.quarantine /Applications/Orca.app 2>/dev/null || true
echo "Done. Opening Orca."
open /Applications/Orca.app
