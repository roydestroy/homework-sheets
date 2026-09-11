'use strict';

// Content scripts only get injected into a tab if the browser's extension subsystem has
// finished starting up by the moment that tab's page begins loading. On a cold boot -
// especially on a machine busy with everything else starting up too - the browser window
// itself can be interactive (restoring tabs, or letting you type a URL) well before its
// extensions are ready, so a page can load with no content script at all. A manual refresh
// fixes it because by then the extension is up. This background worker catches those tabs
// up on startup instead of requiring that manual refresh.

const MATCH_PATTERNS = [
  'https://www.eurognosi-fni.com/group/*',
  'https://www.eurognosi-fni.com/*/group/*',
];

async function injectIntoExistingTabs() {
  let tabs;
  try {
    tabs = await chrome.tabs.query({ url: MATCH_PATTERNS });
  } catch (e) {
    return; // tabs permission/query unavailable for some reason; nothing we can do
  }

  for (const tab of tabs) {
    if (tab.id === undefined) continue;
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => Boolean(window.__egHomeworkSheetsLoaded),
      });
      const alreadyLoaded = results && results[0] && results[0].result;
      if (alreadyLoaded) continue;

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['docx-lib.js', 'content.js'],
      });
    } catch (e) {
      // Tab may have navigated away, closed, or be a page we're not allowed to inject
      // into between the query and now — nothing to do for that one.
    }
  }
}

chrome.runtime.onStartup.addListener(injectIntoExistingTabs);
chrome.runtime.onInstalled.addListener(injectIntoExistingTabs);
