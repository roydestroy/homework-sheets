'use strict';

// This worker exists to inject the content scripts into group pages that the manifest's
// own content-script declaration doesn't reach. There are two such cases, handled below:
// a cold boot that outruns the extension subsystem, and Wix's client-side navigation.

const MATCH_PATTERNS = [
  'https://www.eurognosi-fni.com/group/*',
  'https://www.eurognosi-fni.com/*/group/*',
];

// The same two patterns expressed as webNavigation event filters. webNavigation doesn't
// take match patterns, so the language-prefixed variant (/el/group/..., /en/group/...)
// has to be a regex — note `urlMatches` is a search, not a full match, hence the anchor.
const GROUP_PAGE_URL_FILTER = {
  url: [
    { hostEquals: 'www.eurognosi-fni.com', pathPrefix: '/group/' },
    { hostEquals: 'www.eurognosi-fni.com', urlMatches: '^https://www\\.eurognosi-fni\\.com/[^/]+/group/' },
  ],
};

// Injects docx-lib.js + content.js into a tab's top frame unless they're already there.
// content.js sets window.__egHomeworkSheetsLoaded, so this can't double-run alongside
// the manifest's own injection (or a second call from the other caller below).
async function injectIfMissing(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => Boolean(window.__egHomeworkSheetsLoaded),
    });
    const alreadyLoaded = results && results[0] && results[0].result;
    if (alreadyLoaded) return;

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['docx-lib.js', 'content.js'],
    });
  } catch (e) {
    // Tab may have navigated away, closed, or be a page we're not allowed to inject
    // into between the check and now — nothing to do for that one.
  }
}

// Case 1: cold boot. Content scripts only get injected into a tab if the browser's
// extension subsystem has finished starting up by the moment that tab's page begins
// loading. On a cold boot - especially on a machine busy with everything else starting
// up too - the browser window itself can be interactive (restoring tabs, or letting you
// type a URL) well before its extensions are ready, so a page can load with no content
// script at all. A manual refresh fixes it because by then the extension is up. This
// catches those tabs up on startup instead of requiring that manual refresh.
async function injectIntoExistingTabs() {
  let tabs;
  try {
    tabs = await chrome.tabs.query({ url: MATCH_PATTERNS });
  } catch (e) {
    return; // tabs permission/query unavailable for some reason; nothing we can do
  }

  for (const tab of tabs) {
    if (tab.id === undefined) continue;
    await injectIfMissing(tab.id);
  }
}

chrome.runtime.onStartup.addListener(injectIntoExistingTabs);
chrome.runtime.onInstalled.addListener(injectIntoExistingTabs);

// Case 2: client-side navigation. Wix is a single-page app: clicking from the groups
// list (/groups, which deliberately doesn't match this extension) into a group only
// pushState's the new URL - the document never reloads, so the browser never evaluates
// the manifest's content-script matches again and no injection happens. The address bar
// says /group/..., the feed renders, and the button is simply absent until the teacher
// reloads by hand. Injecting on the history-state update covers that route change; the
// MutationObserver in content.js then picks up the feed items as Wix renders them.
chrome.webNavigation.onHistoryStateUpdated.addListener(details => {
  if (details.frameId !== 0) return; // top-level document only; the feed isn't in an iframe
  injectIfMissing(details.tabId);
}, GROUP_PAGE_URL_FILTER);
