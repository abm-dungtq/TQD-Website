// "Hiệu ứng" menu in the desktop menu bar: on/off switches for the mascot and the weather effect.
import { prefOn, setPref, type PrefKey } from './prefs';

// The site used to offer dark mode and accent colours; drop their saved choices.
try {
  ['tqd-theme', 'tqd-accent'].forEach((key) => localStorage.removeItem(key));
} catch {}

for (const menu of document.querySelectorAll<HTMLElement>('[data-effects-menu]')) {
  const trigger = menu.querySelector<HTMLButtonElement>('[data-effects-trigger]');
  const panel = menu.querySelector<HTMLElement>('[data-effects-panel]');
  if (!trigger || !panel) continue;
  menu.hidden = false;
  panel.querySelectorAll<HTMLInputElement>('input[data-pref]').forEach((i) => (i.checked = prefOn(i.dataset.pref as PrefKey)));

  const setOpen = (open: boolean, focusTrigger = false) => {
    panel.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    if (open) panel.querySelector<HTMLInputElement>('input')?.focus();
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
    if (input.dataset.pref) setPref(input.dataset.pref as PrefKey, input.checked);
  });
}
