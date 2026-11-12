// Interactive handlers for PageActions.astro (Safari-safe Copy Markdown, Send-to-AI disclosure,
// Share/Copy URL) and 1-click Copy buttons on .prose-article <pre> code blocks.

function announce(root: HTMLElement, message: string) {
  const statusEl = root.querySelector<HTMLElement>('[data-page-action-status]');
  if (!statusEl) return;
  statusEl.textContent = message;
  window.setTimeout(() => {
    if (statusEl.textContent === message) statusEl.textContent = '';
  }, 3500);
}

async function writeFetchedTextToClipboard(url: string): Promise<boolean> {
  // Safari requires ClipboardItem to be invoked synchronously within the user gesture
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      const textPromise = fetch(url, { headers: { Accept: 'text/markdown, text/plain' } }).then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        return new Blob([text], { type: 'text/plain' });
      });
      await navigator.clipboard.write([new ClipboardItem({ 'text/plain': textPromise })]);
      return true;
    } catch {
      // Fall back to standard fetch + writeText below
    }
  }
  try {
    const res = await fetch(url, { headers: { Accept: 'text/markdown, text/plain' } });
    if (!res.ok) return false;
    const text = await res.text();
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function initPageActions() {
  document.querySelectorAll<HTMLElement>('[data-page-actions]').forEach((bar) => {
    if (bar.dataset.bound === '1') return;
    bar.dataset.bound = '1';

    const copyMdBtn = bar.querySelector<HTMLButtonElement>('[data-copy-md]');
    const copyMdLabel = bar.querySelector<HTMLElement>('[data-copy-md-label]');
    copyMdBtn?.addEventListener('click', async () => {
      const mdPath = copyMdBtn.dataset.copyMd;
      if (!mdPath) return;
      const ok = await writeFetchedTextToClipboard(mdPath);
      if (ok) {
        if (copyMdLabel) {
          const prev = copyMdLabel.textContent;
          copyMdLabel.textContent = 'Đã chép Markdown';
          window.setTimeout(() => {
            copyMdLabel.textContent = prev || 'Sao chép Markdown';
          }, 2200);
        }
        announce(bar, 'Đã sao chép bản Markdown sạch vào bộ nhớ tạm.');
      } else {
        announce(bar, 'Không thể tự động sao chép — bạn có thể bấm "Xem bản .md".');
      }
    });

    // Send-to-AI disclosure menu
    const dropdown = bar.querySelector<HTMLElement>('[data-ai-dropdown]');
    const trigger = bar.querySelector<HTMLButtonElement>('[data-ai-trigger]');
    const panel = bar.querySelector<HTMLElement>('[data-ai-panel]');

    const closeDropdown = (restoreFocus = false) => {
      if (!trigger || !panel || panel.hidden) return;
      panel.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      if (restoreFocus) trigger.focus();
    };

    trigger?.addEventListener('click', () => {
      if (!panel) return;
      const nextOpen = panel.hidden;
      panel.hidden = !nextOpen;
      trigger.setAttribute('aria-expanded', String(nextOpen));
    });

    panel?.querySelectorAll<HTMLElement>('a').forEach((link) => {
      link.addEventListener('click', () => closeDropdown(false));
    });

    const geminiBtn = bar.querySelector<HTMLButtonElement>('[data-ai-gemini]');
    geminiBtn?.addEventListener('click', async () => {
      const prompt = geminiBtn.dataset.aiGemini || '';
      closeDropdown(false);
      try {
        await navigator.clipboard.writeText(prompt);
        announce(bar, 'Đã chép câu lệnh — hãy dán (⌘V / Ctrl+V) vào Gemini!');
      } catch {
        announce(bar, 'Đang mở Google Gemini…');
      }
      window.open('https://gemini.google.com/app', '_blank', 'noopener,noreferrer');
    });

    document.addEventListener('click', (ev) => {
      if (dropdown && ev.target instanceof Node && !dropdown.contains(ev.target)) {
        closeDropdown(false);
      }
    });

    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && panel && !panel.hidden) {
        ev.stopPropagation();
        closeDropdown(true);
      }
    });

    // Share / Copy canonical URL
    const shareBtn = bar.querySelector<HTMLButtonElement>('[data-share-page]');
    shareBtn?.addEventListener('click', async () => {
      const url = shareBtn.dataset.shareUrl || window.location.href;
      const title = shareBtn.dataset.shareTitle || document.title;
      const isCoarse = window.matchMedia('(pointer: coarse)').matches;
      if (isCoarse && typeof navigator.share === 'function') {
        try {
          await navigator.share({ title, url });
          return;
        } catch {
          // User cancelled or share failed; fall back to clipboard copy
        }
      }
      try {
        await navigator.clipboard.writeText(url);
        announce(bar, 'Đã sao chép đường dẫn trang!');
      } catch {
        announce(bar, url);
      }
    });
  });
}

function enhanceProseCodeBlocks() {
  document.querySelectorAll<HTMLPreElement>('.prose-article pre').forEach((pre) => {
    if (pre.dataset.copyEnhanced === '1') return;
    pre.dataset.copyEnhanced = '1';

    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrap';
    pre.parentNode?.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'code-copy-btn';
    btn.setAttribute('aria-label', 'Sao chép đoạn mã');
    btn.textContent = 'Sao chép';

    btn.addEventListener('click', async () => {
      const code = pre.querySelector('code')?.textContent ?? pre.textContent ?? '';
      try {
        await navigator.clipboard.writeText(code.trimEnd());
        btn.textContent = 'Đã chép';
        window.setTimeout(() => {
          btn.textContent = 'Sao chép';
        }, 2000);
      } catch {
        btn.textContent = 'Lỗi chép';
      }
    });

    wrapper.appendChild(btn);
  });
}

initPageActions();
enhanceProseCodeBlocks();
