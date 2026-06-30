#!/usr/bin/env bash
# Build an unsigned .xpi from the extension files in the repo root.
# The .xpi is just a zip with manifest.json at the top level (no wrapping folder).
# Output: dist/homework-sheets-<version>.xpi
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./manifest.json').version" 2>/dev/null \
  || grep -oE '"version"[^,]*' manifest.json | head -1 | grep -oE '[0-9][0-9.]*')

OUT="dist/homework-sheets-${VERSION}.xpi"
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
