#!/usr/bin/env bash
# Builds the Chrome Web Store zip: the extension with the live origins written into config.js and the
# manifest. The checked-in files keep pointing at localhost for development.
#   scripts/pack-extension.sh <api origin> <web origin> <version>
set -euo pipefail
api=${1:?api origin, e.g. https://stickynotes-backend-production.up.railway.app}
web=${2:?web origin, e.g. https://stickynotes.in}
version=${3:?version, e.g. 1.0.0}
cd "$(dirname "$0")/.."

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
cp -R extension/. "$tmp"
rm -f "$tmp"/*.test.js

API="$api" WEB="$web" VERSION="$version" node -e '
  const fs = require("fs");
  const dir = process.argv[1];
  const { API, WEB, VERSION } = process.env;
  for (const o of [API, WEB]) if (!/^https:\/\/[^/]+$/.test(o)) throw new Error("an origin is https://host with no path: " + o);
  const config = dir + "/config.js";
  const before = fs.readFileSync(config, "utf8");
  const after = before.replace(/API_URL: \x27[^\x27]*\x27/, `API_URL: \x27${API}\x27`).replace(/WEB_ORIGIN: \x27[^\x27]*\x27/, `WEB_ORIGIN: \x27${WEB}\x27`);
  if (after === before) throw new Error("config.js was not rewritten");
  fs.writeFileSync(config, after);
  const manifest = dir + "/manifest.json";
  const m = JSON.parse(fs.readFileSync(manifest, "utf8"));
  m.version = VERSION;
  m.host_permissions = [API + "/*"];
  fs.writeFileSync(manifest, JSON.stringify(m, null, 2) + "\n");
' "$tmp"

mkdir -p dist
out="dist/stickynotes-$version.zip"
rm -f "$out"
(cd "$tmp" && zip -qrX - . -x '.*' '*/.*') > "$out"
echo "$out"
