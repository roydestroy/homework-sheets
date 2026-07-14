# Homework Sheets — Browser Extension

A browser extension (Chrome, Microsoft Edge, Firefox) for [eurognosi-fni.com](https://www.eurognosi-fni.com) that adds a button to each homework post in the school's Wix Groups, generating a printable, two-column Word document — one strip of homework per student, ready to cut and stick into daily planners.

## What it does

Teachers post homework to a Wix group in a simple text format (see [Post Format](#post-format) below). This extension scans the group feed, and for any post that follows the format, adds a **📄 Homework Sheet** button next to it. Clicking the button opens a small panel where you enter the number of students; clicking **Generate Word file** produces a `.docx` and downloads it immediately — no server, no upload, everything happens locally in the browser.

The generated document:

- Repeats the in-class text once at the top, then the homework block once per student, plus one extra slip for the teacher
- Uses two columns and A4 page size to minimize paper use
- Never splits a single student's homework block across a column or page break (so cutting strips never spans two sheets of paper)
- Automatically expands posts that are truncated behind a "Show more" / "Περισσότερα" button before reading them, so long posts are never read partially

## Installation

This is not published on any extension store — it's installed manually as an unpacked extension, since it's intended for internal use by school staff. The same files work on Chrome, Microsoft Edge, and Firefox.

### Chrome / Microsoft Edge

1. Download this repository (**Code → Download ZIP**) and unzip it somewhere permanent on your computer (not a folder you might later delete, like Downloads — the browser keeps loading the extension from this exact location).
2. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge).
3. Toggle on **Developer mode** (top-right corner in Chrome, bottom-left in Edge).
4. Click **Load unpacked**.
5. Select the unzipped folder (the one containing `manifest.json` directly inside it).
6. Visit any group page on `eurognosi-fni.com` (e.g. `/group/...` or `/en/group/...`) — homework posts should now show the **📄 Homework Sheet** button.

### Firefox

Firefox can load the extension two ways:

- **Temporary (quickest, but cleared on restart):** go to `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…**, and select the `manifest.json` file inside the unzipped folder. The extension stays until you quit Firefox.
- **Permanent:** Firefox only installs signed add-ons permanently. Either submit a packaged `.xpi` to [addons.mozilla.org](https://addons.mozilla.org) for signing (it can be kept unlisted/self-distributed), or use **Firefox Developer Edition** / **ESR** with `xpinstall.signatures.required` set to `false` in `about:config`, then install the `.xpi`.

Then visit any `eurognosi-fni.com` group page as above.

### Updating

**Firefox (signed install): updates automatically.** Once a teacher has installed a Mozilla-signed `.xpi`, Firefox periodically checks the update manifest at [`updates.json`](updates.json) in this repo and silently installs newer signed versions — no manual step. See [Releasing a new Firefox version](#releasing-a-new-firefox-version) for how new versions get published.

**Chrome / Edge (store install): updates automatically.** If staff installed the extension from its unlisted Chrome Web Store link (recommended — see [Releasing a new Chrome/Edge version](#releasing-a-new-chromeedge-version)), Chrome and Edge check for and install newer versions on their own, exactly like Firefox. This also fixes the "extension keeps disappearing" problem of unpacked installs.

**Chrome / Edge (unpacked loads) and Firefox temporary loads: manual.** These don't auto-update:

1. Download the latest version of this repo and replace the old folder's contents.
2. Open your browser's extensions page (`chrome://extensions`, `edge://extensions`, or `about:debugging` in Firefox) and click the reload icon (⟳) on the extension's card. In Firefox, a temporary add-on must be loaded again after a restart.

## Releasing a new Firefox version (auto-update pipeline)

Signed Firefox builds are hosted on this repo's **GitHub Releases**, and Firefox finds them through `update_url` in the manifest, which points at [`updates.json`](updates.json). The whole flow is automated by [`.github/workflows/release.yml`](.github/workflows/release.yml).

**One-time setup:**

1. Get a Mozilla add-on API key/secret at [addons.mozilla.org/developers/addon/api/key/](https://addons.mozilla.org/en-US/developers/addon/api/key/).
2. Add them as repository secrets (**Settings → Secrets and variables → Actions**): `AMO_JWT_ISSUER` (the `user:...` key) and `AMO_JWT_SECRET`.

**Each release:**

1. Bump `"version"` in `manifest.json` (e.g. `1.0` → `1.1`). Mozilla rejects re-uploading the same version.
2. Commit, then tag and push: `git tag v1.1 && git push origin v1.1` (the `v1.1` tag must match the manifest version — the workflow checks this).

The workflow then signs the add-on with Mozilla (unlisted), attaches the signed `homework-sheets-1.1.xpi` to a GitHub Release, and rewrites `updates.json` to point at it. Installed Firefox copies pick up the new version on their next update check.

To build an unsigned `.xpi` locally (for manual testing or a one-off upload to AMO), run `./scripts/build-xpi.sh` — it writes `dist/homework-sheets-<version>.xpi`.

## Releasing a new Chrome/Edge version (auto-update pipeline)

Chrome and Edge builds are published to the **Chrome Web Store** as an *unlisted* item (installable only via its direct link, but auto-updating like any store extension). The same [`.github/workflows/release.yml`](.github/workflows/release.yml) that signs Firefox also uploads and publishes the Chrome build — a single version tag releases to both.

**One-time setup:**

1. **Create the store item once, by hand.** Build the upload zip — `./scripts/build-zip.sh` on macOS/Linux, or `.\scripts\build-zip.ps1` in PowerShell on Windows (both write `dist/homework-sheets-<version>.zip`) — then in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) create a new item, upload that zip, set **Visibility → Unlisted**, and publish. Note the **item ID** shown on the item's page (a 32-character string) — that's `CHROME_EXTENSION_ID`. This first publish can't be automated because the item doesn't exist yet; every release after this is automatic.
2. **Set up Chrome Web Store API credentials** so the workflow can upload on your behalf. Following the [chrome-webstore-upload-keys guide](https://github.com/fregante/chrome-webstore-upload/blob/main/How%20to%20generate%20Google%20API%20keys.md): in the Google Cloud Console create a project, enable the **Chrome Web Store API**, create an **OAuth client ID** (Desktop app), then use that client ID/secret to generate a **refresh token**.
3. **Add them as repository secrets** (**Settings → Secrets and variables → Actions**):
   - `CHROME_EXTENSION_ID` — the item ID from step 1
   - `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN` — from step 2

   (Edge is a separate store with its own dashboard and no fee; the same `dist/*.zip` can be uploaded there by hand whenever needed. Only Chrome is automated here.)

**Each release:** identical to Firefox — bump `"version"` in `manifest.json`, then `git tag v1.1 && git push origin v1.1`. The workflow verifies the tag matches the manifest, builds the zip, and uploads + publishes it to the Chrome Web Store; installed Chrome/Edge copies pick up the new version on their next update check.

To build the Chrome/Edge zip locally (for the manual first upload, or Edge), run `./scripts/build-zip.sh` (macOS/Linux) or `.\scripts\build-zip.ps1` (Windows PowerShell).

## Post format

For the button to appear, a post needs two labels, each in capital letters on their own line: `IN CLASS` and `HOMEWORK`. Everything between them is treated as the in-class text; everything after `HOMEWORK` is treated as the homework text.

```
IN CLASS
Student's Book p. 106 - 107 all exs.

HOMEWORK
Workbook p. 62, 63 all exs.
Grammar Book p. 208 all exs.
```

Notes:

- The labels must be in capital letters (`IN CLASS`, `HOMEWORK`) on their own line. Lowercase mentions of the word "homework" elsewhere in the post (e.g. "Ek1 Unit 10 lesson 4 homework") are ignored and won't be mistaken for the label.
- Bold/markdown-style asterisks around the labels (`**IN CLASS**`) are optional — both plain and bolded labels work.
- Posts that don't contain both labels are left alone; no button is added, and nothing about the post is changed.
- Every line break in the original post is preserved as its own line in the generated document.

## How it works (technical notes)

- `manifest.json` — restricts the extension to group pages on eurognosi-fni.com (including language-prefixed paths like `/en/group/...`), and loads the two script files below into the page. It's a Manifest V3 content-script-only extension with no background script or special permissions, so the same file works unchanged on Chrome, Edge, and Firefox; the `browser_specific_settings.gecko` block supplies the add-on ID Firefox requires and is ignored by Chromium browsers.
- `docx-lib.js` — the [docx](https://www.npmjs.com/package/docx) npm library (v9.7.1), bundled directly rather than loaded from a CDN, since the extension content-script CSP blocks loading remote scripts. Note: it's named `docx-lib.js`, not `docx.umd.cjs` — a `.cjs` extension silently breaks content script loading, which took a while to track down.
- `content.js` — finds homework posts on the page (`[data-hook="feed-item"]`), expands any truncated ones, parses the `IN CLASS` / `HOMEWORK` sections, injects the button/panel UI, and generates the `.docx` entirely client-side using `docx-lib.js`.
- `content.css` — styling for the injected button and panel.

All document generation happens in the browser via `Packer.toBlob()` and a triggered download — no data is sent anywhere.

## Known limitations

- If a single student's homework text is itself too long to fit in one column, it will spill into the next column or page (there's no way around this without shrinking the page further) — this should be rare given typical post lengths.
- The "expand truncated post" detection is structural (it looks for the toggle button in its expected position in Wix's markup) rather than text-based, so it should work regardless of site language — but it has only been verified against the Greek and English versions of the group pages.
- This extension is scoped specifically to eurognosi-fni.com's Wix Groups markup and will not work on other sites without adjustment.
