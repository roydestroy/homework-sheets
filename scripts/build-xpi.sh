#!/usr/bin/env bash
# Build an unsigned .xpi from the extension files in the repo root.
# The .xpi is just a zip with manifest.json at the top level (no wrapping folder).
# Firefox needs its own manifest variant (background.scripts instead of
# background.service_worker — see scripts/write-firefox-manifest.js), so this
# stages files into a temp directory rather than zipping the repo root directly.
# Output: dist/homework-sheets-<version>.xpi
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

VERSION=$(node -p "require('./manifest.json').version" 2>/dev/null \
  || grep -oE '"version"[^,]*' manifest.json | head -1 | grep -oE '[0-9][0-9.]*')

OUT="$ROOT/dist/homework-sheets-${VERSION}.xpi"
mkdir -p dist
rm -f "$OUT"

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT

node scripts/write-firefox-manifest.js "$STAGE/manifest.json"
cp background.js content.js content.css docx-lib.js "$STAGE/"
cp -r icons "$STAGE/"

( cd "$STAGE" && zip -r -X "$OUT" \
    manifest.json \
    background.js \
    content.js \
    content.css \
    docx-lib.js \
    icons \
    -x '*.DS_Store' >/dev/null )

echo "Built $OUT"
echo "sha256: $(sha256sum "$OUT" | cut -d' ' -f1)"
