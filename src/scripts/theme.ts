// Light/dark/auto theme and accent colour. The inline script in BaseLayout applies the saved
// choice before first paint; this module wires the menus and cross-fades later changes.
import { prefOn, setPref, type PrefKey } from './prefs';

const MODES = ['light', 'dark', 'auto'] as const;
const ACCENTS = ['blue', 'violet', 'emerald', 'amber', 'rose'] as const;
type Mode = (typeof MODES)[number];
type Accent = (typeof ACCENTS)[number];

const root = document.documentElement;
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

const stored = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
  try {
    const value = localStorage.getItem(key) as T | null;
    return value && allowed.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
};

let mode: Mode = stored('tqd-theme', MODES, 'auto');
let accent: Accent = stored('tqd-accent', ACCENTS, 'blue');

const paint = () => {
  root.dataset.theme = mode === 'dark' || (mode === 'auto' && darkQuery.matches) ? 'dark' : 'light';
  root.dataset.accent = accent;
};

const menus = [...document.querySelectorAll<HTMLElement>('[data-theme-menu]')];

const syncMenus = () => {
  for (const menu of menus) {
    menu.querySelectorAll<HTMLInputElement>('input[data-mode]').forEach((i) => (i.checked = i.value === mode));
    menu.querySelectorAll<HTMLInputElement>('input[data-accent]').forEach((i) => (i.checked = i.value === accent));
    menu.querySelectorAll<HTMLInputElement>('input[data-pref]').forEach((i) => (i.checked = prefOn(i.dataset.pref as PrefKey)));
  }
};

const change = (next: { mode?: Mode; accent?: Accent }) => {
  mode = next.mode ?? mode;
  accent = next.accent ?? accent;
  try {
    localStorage.setItem('tqd-theme', mode);
    localStorage.setItem('tqd-accent', accent);
  } catch {}
  syncMenus();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!document.startViewTransition || reduce) {
    paint();
    return;
  }
  root.setAttribute('data-theme-switching', '');
  document.startViewTransition(paint).finished.finally(() => root.removeAttribute('data-theme-switching'));
};

darkQuery.addEventListener('change', () => {
  if (mode === 'auto') paint();
});

for (const menu of menus) {
  const trigger = menu.querySelector<HTMLButtonElement>('[data-theme-trigger]');
  const panel = menu.querySelector<HTMLElement>('[data-theme-panel]');
  if (!trigger || !panel) continue;
  menu.hidden = false;

  const setOpen = (open: boolean, focusTrigger = false) => {
    panel.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    if (open) panel.querySelector<HTMLInputElement>('input:checked')?.focus();
    else if (focusTrigger) trigger.focus();
  };

  trigger.addEventListener('click', () => setOpen(Boolean(panel.hidden)));
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false, true);
    }
  });
  document.addEventListener('pointerdown', (e) => {
    if (!panel.hidden && !menu.contains(e.target as Node)) setOpen(false);
  });
  panel.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    if (input.dataset.mode !== undefined) change({ mode: input.value as Mode });
    if (input.dataset.accent !== undefined) change({ accent: input.value as Accent });
    if (input.dataset.pref) setPref(input.dataset.pref as PrefKey, input.checked);
  });
}

syncMenus();
paint();
