#!/usr/bin/env bash
# Build a Chrome/Edge Web Store upload zip from the extension files in the repo root.
# The zip has manifest.json at the top level (no wrapping folder), which is what
# the Chrome Web Store expects.
# Output: dist/homework-sheets-<version>.zip
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./manifest.json').version" 2>/dev/null \
  || grep -oE '"version"[^,]*' manifest.json | head -1 | grep -oE '[0-9][0-9.]*')

OUT="dist/homework-sheets-${VERSION}.zip"
mkdir -p dist
rm -f "$OUT"

# Only the files the extension actually needs — never the repo metadata.
zip -r -X "$OUT" \
  manifest.json \
  content.js \
  content.css \
  docx-lib.js \
  icons \
  -x '*.DS_Store' >/dev/null

echo "Built $OUT"
echo "sha256: $(sha256sum "$OUT" | cut -d' ' -f1)"
