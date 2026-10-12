// ⌘K / Ctrl+K / "/" quick search. Loads /search.json on first open and filters it locally.
import { matches } from '../lib/search-text';
import { typing } from './typing';

interface Entry {
  title: string;
  url: string;
  kind: 'section' | 'article' | 'product' | 'training' | 'video';
  hint: string;
  /** Section window that shows this entry on the home-page desktop. */
  id?: string;
}

const GROUPS: Record<Entry['kind'], string> = {
  section: 'Mục',
  article: 'Bài viết',
  product: 'Sản phẩm',
  training: 'Đào tạo',
  video: 'Video AI',
};
const MAX_RESULTS = 8;

const dialog = document.querySelector<HTMLDialogElement>('#cmdk');
const input = document.querySelector<HTMLInputElement>('#cmdk-input');
const list = document.querySelector<HTMLUListElement>('#cmdk-list');
const empty = document.querySelector<HTMLElement>('[data-cmdk-empty]');
const status = document.querySelector<HTMLElement>('[data-cmdk-status]');

if (dialog && input && list && empty && status) {
  let entries: Entry[] | null = null;
  let results: Entry[] = [];
  let active = 0;
  let returnFocus: HTMLElement | null = null;

  const load = async () => {
    if (entries) return;
    status.hidden = false;
    try {
      const res = await fetch('/search.json');
      entries = res.ok ? ((await res.json()) as Entry[]) : [];
    } catch {
      entries = [];
    }
    status.hidden = true;
  };

  const setActive = (index: number) => {
    active = index;
    list.querySelectorAll<HTMLElement>('[role="option"]').forEach((el, i) => {
      el.setAttribute('aria-selected', String(i === index));
      if (i === index) el.scrollIntoView({ block: 'nearest' });
    });
    if (results.length) input.setAttribute('aria-activedescendant', `cmdk-opt-${index}`);
    else input.removeAttribute('aria-activedescendant');
  };

  const render = () => {
    if (!entries) return;
    const query = input.value.trim();
    const order = Object.keys(GROUPS) as Entry['kind'][];
    results = entries
      .filter((e) => matches(query, e.title))
      .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
      .slice(0, MAX_RESULTS);
    list.replaceChildren();
    let group = '';
    results.forEach((entry, i) => {
      if (entry.kind !== group) {
        group = entry.kind;
        const heading = document.createElement('li');
        heading.setAttribute('role', 'presentation');
        heading.className = 'cmdk-group';
        heading.textContent = GROUPS[entry.kind];
        list.appendChild(heading);
      }
      const option = document.createElement('li');
      option.id = `cmdk-opt-${i}`;
      option.setAttribute('role', 'option');
      option.className = 'cmdk-option';
      const title = document.createElement('span');
      title.textContent = entry.title;
      const hint = document.createElement('span');
      hint.textContent = entry.hint;
      option.appendChild(title);
      option.appendChild(hint);
      option.addEventListener('pointermove', () => active !== i && setActive(i));
      option.addEventListener('click', () => go(entry));
      list.appendChild(option);
    });
    empty.hidden = results.length > 0;
    setActive(0);
  };

  const go = (entry: Entry) => {
    // On the home-page desktop, sections and items open as windows instead of new pages.
    if (entry.id && document.querySelector('[data-desktop]:not(.hidden)')) {
      returnFocus = null;
      dialog.close();
      window.dispatchEvent(new CustomEvent('tqd:open', { detail: entry.id }));
      return;
    }
    location.href = entry.url;
  };

  const open = async () => {
    if (dialog.open) return;
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    input.value = '';
    list.replaceChildren();
    empty.hidden = true;
    dialog.showModal();
    window.dispatchEvent(new CustomEvent('tqd:palette', { detail: 'open' }));
    input.focus();
    await load();
    render();
  };

  dialog.addEventListener('close', () => {
    window.dispatchEvent(new CustomEvent('tqd:palette', { detail: 'close' }));
    returnFocus?.focus({ preventScroll: true });
    returnFocus = null;
  });
  // A click on the backdrop lands on the dialog element itself.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  input.addEventListener('input', render);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!results.length) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((active + step + results.length) % results.length);
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      go(results[active]);
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (dialog.open) dialog.close();
      else void open();
    } else if (e.key === '/' && !dialog.open && !typing(document.activeElement)) {
      e.preventDefault();
      void open();
    }
  });

  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  document.querySelectorAll<HTMLButtonElement>('[data-cmdk-open]').forEach((button) => {
    button.hidden = false;
    const kbd = button.querySelector('kbd');
    if (kbd && isMac) kbd.textContent = '⌘K';
    button.addEventListener('click', () => void open());
  });
}
