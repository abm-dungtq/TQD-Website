// Window manager for the home-page desktop (src/components/DesktopShell.astro).
// The desktop only runs on wide screens; elsewhere the plain page stays visible.

const WIDE_QUERY = '(min-width: 1024px)';
const DEFAULT_WINDOW = 'ho-so';
const MENU_HEIGHT = 32;

const desktop = document.querySelector<HTMLElement>('[data-desktop]');
const fallback = document.querySelector<HTMLElement>('[data-fallback]');
const skipLink = document.querySelector<HTMLAnchorElement>('[data-skip]');

if (desktop && fallback) {
  const wide = window.matchMedia(WIDE_QUERY);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const windows = new Map<string, HTMLElement>();
  const openers = new Map<string, HTMLElement>();
  let zTop = 10;
  let opened = 0;
  let booted = false;

  desktop.querySelectorAll<HTMLElement>('[data-window]').forEach((win) => {
    const id = win.dataset.window;
    if (id) windows.set(id, win);
  });

  const setActiveDock = () => {
    desktop.querySelectorAll<HTMLElement>('.desktop-dock-item').forEach((item) => {
      const win = item.dataset.open ? windows.get(item.dataset.open) : undefined;
      item.toggleAttribute('data-active', Boolean(win && !win.hidden));
    });
  };

  const focusWindow = (win: HTMLElement) => {
    zTop += 1;
    win.style.zIndex = String(zTop);
  };

  const topWindow = (): HTMLElement | undefined =>
    [...windows.values()]
      .filter((w) => !w.hidden)
      .sort((a, b) => Number(b.style.zIndex) - Number(a.style.zIndex))[0];

  const clampWindow = (win: HTMLElement) => {
    if (win.hidden || !win.style.left) return;
    const maxLeft = window.innerWidth - 80;
    const maxTop = window.innerHeight - 60;
    win.style.left = `${Math.min(Math.max(win.offsetLeft, 80 - win.offsetWidth), maxLeft)}px`;
    win.style.top = `${Math.min(Math.max(win.offsetTop, MENU_HEIGHT), maxTop)}px`;
  };

  const placeWindow = (win: HTMLElement) => {
    // Cascade new windows from the top-left, to the right of the launcher column.
    const offset = (opened % 6) * 28;
    const left = Math.min(150 + offset, Math.max(0, window.innerWidth - win.offsetWidth - 16));
    const top = Math.min(MENU_HEIGHT + 24 + offset, Math.max(MENU_HEIGHT, window.innerHeight - win.offsetHeight - 90));
    win.style.left = `${left}px`;
    win.style.top = `${top}px`;
    opened += 1;
  };

  const open = (id: string, opener?: HTMLElement) => {
    const win = windows.get(id);
    if (!win) return;
    if (opener) openers.set(id, opener);
    if (win.hidden) {
      win.hidden = false;
      if (!win.style.left) placeWindow(win);
      if (!reducedMotion.matches) {
        win.setAttribute('data-opening', '');
        win.addEventListener('animationend', () => win.removeAttribute('data-opening'), { once: true });
      }
    }
    focusWindow(win);
    win.querySelector<HTMLElement>('[data-close]')?.focus({ preventScroll: true });
    history.replaceState(null, '', `#${id}`);
    setActiveDock();
  };

  const close = (id: string) => {
    const win = windows.get(id);
    if (!win) return;
    win.hidden = true;
    // Windows opened from the URL hash have no opener; fall back to their launcher icon.
    const opener = openers.get(id) ?? desktop.querySelector<HTMLElement>(`.desktop-launch[data-open="${id}"]`);
    opener?.focus({ preventScroll: true });
    const next = topWindow();
    history.replaceState(null, '', next?.dataset.window ? `#${next.dataset.window}` : location.pathname);
    setActiveDock();
  };

  const enableDrag = (win: HTMLElement) => {
    const handle = win.querySelector<HTMLElement>('[data-drag]');
    if (!handle) return;
    handle.addEventListener('pointerdown', (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest('a, button')) return;
      focusWindow(win);
      const startX = event.clientX - win.offsetLeft;
      const startY = event.clientY - win.offsetTop;
      handle.setPointerCapture(event.pointerId);
      const move = (e: PointerEvent) => {
        const maxLeft = window.innerWidth - 80;
        const maxTop = window.innerHeight - 60;
        win.style.left = `${Math.min(Math.max(e.clientX - startX, 80 - win.offsetWidth), maxLeft)}px`;
        win.style.top = `${Math.min(Math.max(e.clientY - startY, MENU_HEIGHT), maxTop)}px`;
      };
      const stop = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', stop);
        handle.removeEventListener('pointercancel', stop);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', stop);
      handle.addEventListener('pointercancel', stop);
    });
  };

  const boot = () => {
    booted = true;
    windows.forEach((win, id) => {
      enableDrag(win);
      win.addEventListener('pointerdown', () => focusWindow(win));
      win.querySelector<HTMLElement>('[data-close]')?.addEventListener('click', () => close(id));
    });
    desktop.querySelectorAll<HTMLElement>('[data-open]').forEach((button) => {
      button.addEventListener('click', () => {
        if (button.dataset.open) open(button.dataset.open, button);
      });
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || desktop.classList.contains('hidden')) return;
      const win = topWindow();
      if (win?.dataset.window) close(win.dataset.window);
    });

    const clock = desktop.querySelector<HTMLElement>('[data-clock]');
    if (clock) {
      const format = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Saigon' });
      const tick = () => {
        clock.textContent = format.format(new Date());
      };
      tick();
      window.setInterval(tick, 30_000);
    }

    window.addEventListener('resize', () => windows.forEach(clampWindow));

    const fromHash = location.hash.slice(1);
    open(windows.has(fromHash) ? fromHash : DEFAULT_WINDOW);
  };

  const apply = () => {
    desktop.classList.toggle('hidden', !wide.matches);
    fallback.classList.toggle('hidden', wide.matches);
    skipLink?.setAttribute('href', wide.matches ? '#desktop' : '#main');
    if (wide.matches && !booted) boot();
  };

  apply();
  wide.addEventListener('change', apply);
}
