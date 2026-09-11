#!/usr/bin/env node
// Writes a Firefox-compatible copy of manifest.json to the given output path.
//
// Chrome's Web Store validator rejects "background.scripts" outright under
// manifest_version 3 (it's an MV2-only key) - manifest.json in the repo root
// uses "background.service_worker" for that reason, which is what Chrome/Edge
// actually need. Firefox's own linter (run by `web-ext sign`) wants the exact
// opposite: it errors ("BACKGROUND_SERVICE_WORKER_NOFALLBACK") if
// "background.service_worker" is present without a "background.scripts"
// fallback. The two stores want mutually exclusive things from this one key,
// so Firefox gets its own manifest variant here instead.
'use strict';

const fs = require('fs');
const path = require('path');

const [, , outPath] = process.argv;
if (!outPath) {
  console.error('Usage: write-firefox-manifest.js <output-path>');
  process.exit(1);
}

const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'manifest.json'), 'utf8')
);
manifest.background = { scripts: ['background.js'] };

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n');
