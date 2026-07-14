(function () {
  'use strict';

  const TEXT_COLOR = "000000";
  const PROCESSED_ATTR = 'data-eg-homework-button';

  // ---------- Parsing ----------

  function extractPostLines(feedItemEl) {
    const contentEl = feedItemEl.querySelector('[data-hook="feed-item-content"]');
    if (!contentEl) return [];

    // Each line of the post is a <p> or <div> inside the ricos viewer.
    // Walk them in document order, one array entry per line (blank lines kept as '').
    const lineEls = contentEl.querySelectorAll('p, div[id^="viewer-"]');
    const lines = [];
    lineEls.forEach(el => {
      // Skip if this element itself contains nested line elements (avoid duplicating text)
      if (el.querySelector('p, div[id^="viewer-"]')) return;
      const text = el.textContent.replace(/\u00A0/g, ' ').trim();
      lines.push(text);
    });
    return lines;
  }

  function getPostTitle(feedItemEl) {
    const titleEl = feedItemEl.querySelector('[data-hook="feed-item-title"]');
    return titleEl ? titleEl.textContent.trim() : 'Homework';
  }

  // Wix truncates long posts behind a "More"/"Show More"/"Περισσότερα" button, depending
  // on the site's language. Rather than maintain a list of every possible translation,
  // we detect the button structurally: it's the lone <button> sitting in the small wrapper
  // div that comes right after the ricos viewer, inside feed-item-content. This is the same
  // position regardless of language. A short text-list is kept only as a fallback signal.
  const MORE_BUTTON_TEXTS_FALLBACK = [
    'Περισσότερα', 'Δείτε περισσότερα', // Greek
    'More', 'Show more', 'See more', 'Read more', // English variants seen across Wix products
  ];

  function findMoreButton(feedItemEl) {
    const contentWrapper = feedItemEl.querySelector('[data-hook="feed-item-content"]');
    if (!contentWrapper) return null;

    const ricosViewer = contentWrapper.querySelector('[data-hook="feed-item-ricos-viewer"]');
    if (ricosViewer && ricosViewer.nextElementSibling) {
      const sibling = ricosViewer.nextElementSibling;
      // The expand/collapse wrapper holds exactly one button and nothing else of substance
      const btn = sibling.querySelector('button');
      if (btn && sibling.querySelectorAll('button').length === 1) return btn;
    }

    // Fallback: language-list text match, in case the structure above doesn't apply
    const candidates = contentWrapper.querySelectorAll('button');
    for (const btn of candidates) {
      const text = btn.textContent.trim();
      if (MORE_BUTTON_TEXTS_FALLBACK.some(t => text === t)) return btn;
    }
    return null;
  }

  function waitForDomSettle(container, timeoutMs = 2500) {
    return new Promise(resolve => {
      let settleTimer = null;
      const obs = new MutationObserver(() => {
        clearTimeout(settleTimer);
        settleTimer = setTimeout(() => {
          obs.disconnect();
          resolve();
        }, 400); // no new mutations for 400ms = content has finished rendering
      });
      obs.observe(container, { childList: true, subtree: true, characterData: true });
      // Safety net in case no mutation ever fires (e.g. button was already expanded)
      setTimeout(() => { obs.disconnect(); resolve(); }, timeoutMs);
    });
  }

  async function ensureExpanded(feedItemEl) {
    const moreBtn = findMoreButton(feedItemEl);
    if (!moreBtn) return; // no toggle button at all, nothing to do

    const contentWrapper = feedItemEl.querySelector('[data-hook="feed-item-content"]');
    const lengthBefore = contentWrapper.textContent.length;

    const settled = waitForDomSettle(contentWrapper);
    moreBtn.click();
    await settled;

    const lengthAfter = contentWrapper.textContent.length;
    if (lengthAfter < lengthBefore) {
      // The click made content shorter — it was already expanded and we just collapsed it.
      // Click again to restore the (longer, correct) expanded state.
      const settledAgain = waitForDomSettle(contentWrapper);
      moreBtn.click();
      await settledAgain;
    }
  }

  // Belt-and-suspenders for ensureExpanded: re-attempts parsing a few times with short
  // delays, in case the post's real render timing doesn't match our mutation-settle guess.
  // This makes correctness independent of any specific timing assumption.
  async function extractAndParseWithRetry(feedItemEl, attempts = 4, delayMs = 350) {
    for (let i = 0; i < attempts; i++) {
      const lines = extractPostLines(feedItemEl);
      // parsePost may throw ("HOMEWORK before IN CLASS") — that won't fix itself
      // on retry, so let it propagate instead of retrying.
      const parsed = parsePost(lines);
      if (parsed) return parsed;
      if (i < attempts - 1) await new Promise(r => setTimeout(r, delayMs));
    }
    return null;
  }

  // Matches a line that is ONLY the marker (optionally bold, optionally with a colon),
  // e.g. "IN CLASS", "**HOMEWORK**", "HOMEWORK:" — not a line that merely contains the word.
  const IN_CLASS_LINE = /^\*{0,2}IN[\s-]+CLASS:?\*{0,2}:?$/;
  const HOMEWORK_LINE = /^\*{0,2}HOMEWORK:?\*{0,2}:?$/;

  function parsePost(lines) {
    const inClassIdx = lines.findIndex(l => IN_CLASS_LINE.test(l.trim()));
    const homeworkIdx = lines.findIndex(l => HOMEWORK_LINE.test(l.trim()));

    if (inClassIdx === -1 || homeworkIdx === -1) {
      return null; // signals "this post doesn't follow the convention"
    }
    if (homeworkIdx < inClassIdx) {
      throw new Error('"HOMEWORK" appears before "IN CLASS" in this post — please check it manually.');
    }

    // Keep the marker lines themselves as part of each section's content,
    // so "IN CLASS" / "HOMEWORK" still show up as labels in the generated document.
    const inClassLines = lines.slice(inClassIdx, homeworkIdx);
    const homeworkLines = lines.slice(homeworkIdx);

    // Trim trailing blank lines from each section
    while (inClassLines.length && !inClassLines[inClassLines.length - 1].trim()) inClassLines.pop();
    while (homeworkLines.length && !homeworkLines[homeworkLines.length - 1].trim()) homeworkLines.pop();

    if (inClassLines.length <= 1 || homeworkLines.length <= 1) return null; // only the label line, no real content

    return { inClassLines, homeworkLines };
  }

  // ---------- Docx generation ----------

  function paragraphFromLine(line, isLastInBlock) {
    const { Paragraph, TextRun } = window.docx;
    const baseProps = {
      spacing: { after: 120 },
      keepLines: true,       // a single wrapped line never splits mid-line across a column/page
      keepNext: !isLastInBlock, // glue to the next line so the whole block stays on one column/page
    };
    if (!line.trim()) {
      return new Paragraph({ text: "", ...baseProps });
    }
    const runs = [];
    const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(p => p.length > 0);
    parts.forEach(part => {
      const isBold = /^\*\*[^*]+\*\*$/.test(part);
      const content = isBold ? part.slice(2, -2) : part;
      runs.push(new TextRun({
        text: content,
        bold: isBold,
        color: TEXT_COLOR,
        font: "Calibri",
        size: 20, // 10pt — small enough that most homework blocks fit one column without overflow
      }));
    });
    return new Paragraph({ children: runs, ...baseProps });
  }

  // Builds one "block" (in-class text, or one student's homework) as a list of paragraphs
  // that are all glued together (keepNext) so the block can never be split across a
  // column or page break — except for the trailing spacer, which is intentionally NOT
  // glued, so different students' blocks can still break between each other normally.
  function blockParagraphs(lines) {
    const { Paragraph } = window.docx;
    const paragraphs = lines.map((line, idx) => paragraphFromLine(line, idx === lines.length - 1));
    paragraphs.push(new Paragraph({ text: "", spacing: { after: 200 } })); // spacer, not glued
    return paragraphs;
  }

  function buildDocument(inClassLines, homeworkLines, studentCount) {
    const { Document } = window.docx;
    const children = [];

    children.push(...blockParagraphs(inClassLines));

    // studentCount + 1: one homework slip per student, plus one for the teacher
    for (let i = 0; i < studentCount + 1; i++) {
      children.push(...blockParagraphs(homeworkLines));
    }

    return new Document({
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 720, right: 720, bottom: 720, left: 720 }, // 1.27cm — Word's "Narrow" preset
          },
          column: { count: 2, space: 720 } // two columns, 0.5" gutter — saves paper for cutting into strips
        },
        children
      }]
    });
  }

  async function generateAndDownload(inClassLines, homeworkLines, studentCount, fileName) {
    const { Packer } = window.docx;
    const doc = buildDocument(inClassLines, homeworkLines, studentCount);
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.endsWith('.docx') ? fileName : fileName + '.docx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoking synchronously can abort the download in Firefox — give it a moment to start
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // ---------- UI ----------

  const MAX_STUDENTS = 60;

  function createPanel(parsed, defaultTitle) {
    const panel = document.createElement('div');
    panel.className = 'eg-hw-panel';
    panel.innerHTML = `
      <div class="eg-hw-row">
        <label class="eg-hw-label">Students</label>
        <input type="number" class="eg-hw-input-count" min="1" max="${MAX_STUDENTS}" value="10">
        <input type="text" class="eg-hw-input-name">
        <button class="eg-hw-generate-btn">Generate Word file</button>
      </div>
      <div class="eg-hw-msg"></div>
    `;
    panel.style.display = 'none';

    const btn = panel.querySelector('.eg-hw-generate-btn');
    const msg = panel.querySelector('.eg-hw-msg');
    const countInput = panel.querySelector('.eg-hw-input-count');
    const nameInput = panel.querySelector('.eg-hw-input-name');
    nameInput.value = defaultTitle;

    btn.addEventListener('click', async () => {
      msg.textContent = '';
      msg.className = 'eg-hw-msg';
      const studentCount = parseInt(countInput.value, 10);
      if (!studentCount || studentCount < 1 || studentCount > MAX_STUDENTS) {
        msg.textContent = `Please enter a number of students between 1 and ${MAX_STUDENTS}.`;
        msg.className = 'eg-hw-msg eg-hw-error';
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Generating...';
      try {
        await generateAndDownload(parsed.inClassLines, parsed.homeworkLines, studentCount, nameInput.value.trim() || 'Homework');
        msg.textContent = 'Word file downloaded.';
        msg.className = 'eg-hw-msg eg-hw-success';
      } catch (err) {
        msg.textContent = err.message || 'Something went wrong.';
        msg.className = 'eg-hw-msg eg-hw-error';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Generate Word file';
      }
    });

    return panel;
  }

  async function injectButton(feedItemEl) {
    if (feedItemEl.hasAttribute(PROCESSED_ATTR)) return;
    feedItemEl.setAttribute(PROCESSED_ATTR, 'true');

    await ensureExpanded(feedItemEl);

    let parsed;
    try {
      parsed = await extractAndParseWithRetry(feedItemEl);
    } catch (e) {
      parsed = null;
    }
    if (!parsed) return; // not a homework post, skip silently

    const actionsEl = feedItemEl.querySelector('[data-hook="feed-item-stats"]')
                    || feedItemEl.querySelector('[data-hook="feed-item-actions"]');
    if (!actionsEl) return;

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'eg-hw-toggle-btn';
    toggleBtn.textContent = '📄 Homework Sheet';
    toggleBtn.type = 'button';

    const title = getPostTitle(feedItemEl);
    const panel = createPanel(parsed, title);

    toggleBtn.addEventListener('click', () => {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });

    actionsEl.parentElement.insertAdjacentElement('afterend', panel);
    actionsEl.appendChild(toggleBtn);
  }

  function scanForPosts() {
    document.querySelectorAll('[data-hook="feed-item"]').forEach(el => {
      injectButton(el); // async, fire-and-forget; each post processes independently
    });
  }

  // Initial scan
  scanForPosts();

  // Wix Groups loads posts dynamically (infinite scroll / SPA navigation) — watch for new
  // ones. Wix mutates the DOM constantly (and our own injections mutate it too), so the
  // scan is debounced: one pass shortly after mutations quiet down, not one per mutation.
  let scanTimer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scanForPosts, 200);
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
