# Homework Sheets — Chrome Extension

A Chrome extension for [eurognosi-fni.com](https://www.eurognosi-fni.com) that adds a button to each homework post in the school's Wix Groups, generating a printable, two-column Word document — one strip of homework per student, ready to cut and stick into daily planners.

## What it does

Teachers post homework to a Wix group in a simple text format (see [Post Format](#post-format) below). This extension scans the group feed, and for any post that follows the format, adds a **📄 Homework Sheet** button next to it. Clicking the button opens a small panel where you enter the number of students; clicking **Generate Word file** produces a `.docx` and downloads it immediately — no server, no upload, everything happens locally in the browser.

The generated document:

- Repeats the in-class text once at the top, then the homework block once per student
- Uses two columns and A4 page size to minimize paper use
- Never splits a single student's homework block across a column or page break (so cutting strips never spans two sheets of paper)
- Automatically expands posts that are truncated behind a "Show more" / "Περισσότερα" button before reading them, so long posts are never read partially

## Installation

This is not published on the Chrome Web Store — it's installed manually as an unpacked extension, since it's intended for internal use by school staff.

1. Download this repository (**Code → Download ZIP**) and unzip it somewhere permanent on your computer (not a folder you might later delete, like Downloads — Chrome keeps loading the extension from this exact location).
2. Open Chrome and go to `chrome://extensions`.
3. Toggle on **Developer mode** (top-right corner).
4. Click **Load unpacked**.
5. Select the unzipped folder (the one containing `manifest.json` directly inside it).
6. Visit any group page on `eurognosi-fni.com` (e.g. `/group/...` or `/en/group/...`) — homework posts should now show the **📄 Homework Sheet** button.

### Updating

Since this isn't auto-updating through the Web Store:

1. Download the latest version of this repo and replace the old folder's contents.
2. Go to `chrome://extensions` and click the reload icon (⟳) on the extension's card.

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

- `manifest.json` — restricts the extension to group pages on eurognosi-fni.com (including language-prefixed paths like `/en/group/...`), and loads the two script files below into the page.
- `docx-lib.js` — the [docx](https://www.npmjs.com/package/docx) npm library (v9.7.1), bundled directly rather than loaded from a CDN, since Chrome's extension content-script CSP blocks loading remote scripts. Note: it's named `docx-lib.js`, not `docx.umd.cjs` — a `.cjs` extension silently breaks Chrome's content script loading, which took a while to track down.
- `content.js` — finds homework posts on the page (`[data-hook="feed-item"]`), expands any truncated ones, parses the `IN CLASS` / `HOMEWORK` sections, injects the button/panel UI, and generates the `.docx` entirely client-side using `docx-lib.js`.
- `content.css` — styling for the injected button and panel.

All document generation happens in the browser via `Packer.toBlob()` and a triggered download — no data is sent anywhere.

## Known limitations

- If a single student's homework text is itself too long to fit in one column, it will spill into the next column or page (there's no way around this without shrinking the page further) — this should be rare given typical post lengths.
- The "expand truncated post" detection is structural (it looks for the toggle button in its expected position in Wix's markup) rather than text-based, so it should work regardless of site language — but it has only been verified against the Greek and English versions of the group pages.
- This extension is scoped specifically to eurognosi-fni.com's Wix Groups markup and will not work on other sites without adjustment.
