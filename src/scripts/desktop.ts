// Window manager for the home-page desktop (src/components/DesktopShell.astro).
// The desktop only runs on wide screens; elsewhere the plain page stays visible.
import { enableDockMagnify } from './dock';
import { createExpose } from './expose';
import { typing } from './typing';

const WIDE_QUERY = '(min-width: 1024px)';
const DEFAULT_WINDOW = 'ho-so';
const MENU_HEIGHT = 32;
const SNAP_EDGE = 24;
const DRAG_THRESHOLD = 4;
// First-load composition on wide screens, left to right; the first one ends up on top.
const BOOT_WINDOWS = ['ho-so', 'san-pham', 'bai-viet'];
// Usable canvas: right of the launcher column, below the menu bar, above the dock.
const CANVAS_LEFT = 150;
const CANVAS_TOP = MENU_HEIGHT + 24;
const GUTTER = 24;

type WindowMotion = typeof import('./window-motion');

const whenIdle = (run: () => void) => {
  const idle = () => ('requestIdleCallback' in window ? requestIdleCallback(run, { timeout: 2000 }) : setTimeout(run, 200));
  if (document.readyState === 'complete') idle();
  else window.addEventListener('load', idle, { once: true });
};

const desktop = document.querySelector<HTMLElement>('[data-desktop]');
const fallback = document.querySelector<HTMLElement>('[data-fallback]');
const skipLink = document.querySelector<HTMLAnchorElement>('[data-skip]');

if (desktop && fallback) {
  const wide = window.matchMedia(WIDE_QUERY);
  const windows = new Map<string, HTMLElement>();
  const openers = new Map<string, HTMLElement>();
  const snapPreview = desktop.querySelector<HTMLElement>('[data-snap-preview]');
  const exposeButton = desktop.querySelector<HTMLElement>('[data-expose-toggle]');
  let motion: WindowMotion | null = null;
  let zTop = 10;
  let opened = 0;
  let booted = false;

  desktop.querySelectorAll<HTMLElement>('[data-window]').forEach((win) => {
    const id = win.dataset.window;
    if (id) windows.set(id, win);
  });

  const dockItem = (id: string) => desktop.querySelector<HTMLElement>(`.desktop-dock-item[data-open="${id}"]`);
  const isMinimized = (win: HTMLElement) => win.hasAttribute('data-minimized');

  const setActiveDock = () => {
    windows.forEach((win, id) => dockItem(id)?.classList.toggle('is-open', !win.hidden || isMinimized(win)));
  };

  const focusWindow = (win: HTMLElement) => {
    zTop += 1;
    win.style.zIndex = String(zTop);
  };

  const visibleWindows = () => [...windows.values()].filter((w) => !w.hidden);

  const topWindow = (): HTMLElement | undefined =>
    visibleWindows().sort((a, b) => Number(b.style.zIndex) - Number(a.style.zIndex))[0];

  const syncHash = () => {
    const top = topWindow();
    history.replaceState(null, '', top?.dataset.window ? `#${top.dataset.window}` : location.pathname);
  };

  const expose = createExpose(
    desktop,
    visibleWindows,
    (win) => {
      focusWindow(win);
      win.querySelector<HTMLElement>('[data-close]')?.focus({ preventScroll: true });
      syncHash();
    },
    (active) => exposeButton?.setAttribute('aria-pressed', String(active)),
  );

  const clampWindow = (win: HTMLElement) => {
    if (win.hidden || !win.style.left) return;
    const maxLeft = window.innerWidth - 80;
    const maxTop = window.innerHeight - 60;
    win.style.left = `${Math.min(Math.max(win.offsetLeft, 80 - win.offsetWidth), maxLeft)}px`;
    win.style.top = `${Math.min(Math.max(win.offsetTop, MENU_HEIGHT), maxTop)}px`;
  };

  /** Sizes windows from the viewport and returns how many fit side by side (1 to 3). */
  const layoutWindows = () => {
    const width = window.innerWidth - CANVAS_LEFT - GUTTER;
    const height = window.innerHeight - CANVAS_TOP - 92;
    const count = width < 1264 ? 1 : width < 2268 ? 2 : 3;
    const winWidth = Math.min(980, Math.floor((width - GUTTER * (count - 1)) / count));
    desktop.style.setProperty('--win-w', `${winWidth}px`);
    desktop.style.setProperty('--win-h', `${Math.min(880, Math.max(560, height))}px`);
    return { count, winWidth };
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

  const restore = async (id: string) => {
    const win = windows.get(id);
    const item = dockItem(id);
    if (!win || !isMinimized(win)) return;
    win.removeAttribute('data-minimized');
    win.hidden = false;
    focusWindow(win);
    setActiveDock();
    syncHash();
    if (motion && item) await motion.animateRestore(win, item.getBoundingClientRect());
    win.querySelector<HTMLElement>('[data-close]')?.focus({ preventScroll: true });
  };

  const open = (id: string, opener?: HTMLElement) => {
    const win = windows.get(id);
    if (!win) return;
    if (expose.active) expose.exit();
    if (opener) openers.set(id, opener);
    if (isMinimized(win)) {
      void restore(id);
      return;
    }
    const wasHidden = win.hidden;
    if (wasHidden) {
      win.hidden = false;
      if (!win.style.left) placeWindow(win);
    }
    focusWindow(win);
    win.querySelector<HTMLElement>('[data-close]')?.focus({ preventScroll: true });
    history.replaceState(null, '', `#${id}`);
    setActiveDock();
    if (wasHidden && opener && motion) void motion.animateOpen(win, opener.getBoundingClientRect());
  };

  const close = async (id: string) => {
    const win = windows.get(id);
    if (!win || win.hidden || win.hasAttribute('data-closing')) return;
    win.setAttribute('data-closing', '');
    if (motion) await motion.animateClose(win);
    win.removeAttribute('data-closing');
    win.hidden = true;
    win.removeAttribute('data-maximized');
    win.removeAttribute('data-snap');
    // Windows opened from the URL hash have no opener; fall back to their launcher icon.
    const opener = openers.get(id) ?? desktop.querySelector<HTMLElement>(`.desktop-launch[data-open="${id}"]`);
    opener?.focus({ preventScroll: true });
    syncHash();
    setActiveDock();
  };

  const minimize = async (id: string) => {
    const win = windows.get(id);
    const item = dockItem(id);
    if (!win || win.hidden || !item) return;
    if (motion) await motion.animateMinimize(win, item.getBoundingClientRect());
    win.setAttribute('data-minimized', '');
    win.hidden = true;
    item.focus({ preventScroll: true });
    syncHash();
    setActiveDock();
  };

  /** Applies a layout change to a window, animated with FLIP when motion is loaded. */
  const relayout = (win: HTMLElement, change: () => void) => (motion ? motion.flip(win, change) : (change(), Promise.resolve()));

  const toggleMaximize = (win: HTMLElement) =>
    relayout(win, () => {
      win.removeAttribute('data-snap');
      win.toggleAttribute('data-maximized');
    });

  const enableDrag = (win: HTMLElement) => {
    const handle = win.querySelector<HTMLElement>('[data-drag]');
    if (!handle) return;
    handle.addEventListener('dblclick', (event) => {
      if (!(event.target as Element).closest('a, button')) void toggleMaximize(win);
    });
    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || (event.target as Element).closest('a, button')) return;
      focusWindow(win);
      const docked = win.hasAttribute('data-maximized') || win.hasAttribute('data-snap');
      let detached = !docked;
      let startX = event.clientX - win.offsetLeft;
      let startY = event.clientY - win.offsetTop;
      let side: 'left' | 'right' | null = null;
      let dragging = false;
      handle.setPointerCapture(event.pointerId);

      const move = (e: PointerEvent) => {
        if (!dragging) {
          if (Math.hypot(e.clientX - event.clientX, e.clientY - event.clientY) < DRAG_THRESHOLD) return;
          dragging = true;
          window.dispatchEvent(new CustomEvent('tqd:drag', { detail: 'start' }));
        }
        if (!detached) {
          // Leaving a maximized or snapped state: go back to the normal size under the pointer.
          const rect = win.getBoundingClientRect();
          const ratio = (event.clientX - rect.left) / rect.width;
          win.removeAttribute('data-maximized');
          win.removeAttribute('data-snap');
          startX = ratio * win.offsetWidth;
          startY = event.clientY - rect.top;
          detached = true;
        }
        const maxLeft = window.innerWidth - 80;
        const maxTop = window.innerHeight - 60;
        win.style.left = `${Math.min(Math.max(e.clientX - startX, 80 - win.offsetWidth), maxLeft)}px`;
        win.style.top = `${Math.min(Math.max(e.clientY - startY, MENU_HEIGHT), maxTop)}px`;
        side = e.clientX < SNAP_EDGE ? 'left' : e.clientX > window.innerWidth - SNAP_EDGE ? 'right' : null;
        if (snapPreview) {
          snapPreview.hidden = !side;
          snapPreview.style.left = side === 'right' ? 'calc(50vw + 4px)' : '8px';
        }
      };
      const stop = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', stop);
        handle.removeEventListener('pointercancel', stop);
        if (snapPreview) snapPreview.hidden = true;
        if (dragging) window.dispatchEvent(new CustomEvent('tqd:drag', { detail: 'end' }));
        const target = side;
        if (target) void relayout(win, () => win.setAttribute('data-snap', target));
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', stop);
      handle.addEventListener('pointercancel', stop);
    });
  };

  const toggleExpose = () => (expose.active ? expose.exit() : expose.enter());

  const boot = () => {
    booted = true;
    // Animations are only needed on the desktop, so they load with it.
    import('./window-motion').then((m) => (motion = m)).catch(() => {});
    // Extras wait until the page has loaded and the browser is idle, so they never delay first paint.
    whenIdle(() => {
      import('./wallpaper').then((m) => m.startWallpaper(desktop)).catch(() => {});
      import('./weather').then((m) => m.startWeather(desktop)).catch(() => {});
      import('./mascot').then((m) => m.startMascot(desktop)).catch(() => {});
    });

    windows.forEach((win, id) => {
      enableDrag(win);
      win.addEventListener('pointerdown', () => focusWindow(win));
      win.querySelector<HTMLElement>('[data-close]')?.addEventListener('click', () => void close(id));
      win.querySelector<HTMLElement>('[data-minimize]')?.addEventListener('click', () => void minimize(id));
      win.querySelector<HTMLElement>('[data-maximize]')?.addEventListener('click', () => void toggleMaximize(win));
    });
    desktop.querySelectorAll<HTMLElement>('[data-open]').forEach((button) => {
      button.addEventListener('click', () => {
        if (button.dataset.open) open(button.dataset.open, button);
      });
    });
    exposeButton?.addEventListener('click', toggleExpose);
    window.addEventListener('tqd:open', (event) => {
      const id = (event as CustomEvent<string>).detail;
      if (!desktop.classList.contains('hidden')) open(id, dockItem(id) ?? undefined);
    });

    document.addEventListener('keydown', (event) => {
      if (desktop.classList.contains('hidden') || document.querySelector('dialog[open]') || typing(document.activeElement)) return;
      if (event.key === 'F3' || (event.key === 'ArrowUp' && event.ctrlKey)) {
        event.preventDefault();
        toggleExpose();
        return;
      }
      if (event.key !== 'Escape') return;
      if (expose.active) {
        expose.exit();
        return;
      }
      const win = topWindow();
      if (win?.dataset.window) void close(win.dataset.window);
    });

    const dock = desktop.querySelector<HTMLElement>('.desktop-dock');
    if (dock) enableDockMagnify(dock);

    const clock = desktop.querySelector<HTMLElement>('[data-clock]');
    if (clock) {
      const format = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Saigon' });
      const tick = () => {
        clock.textContent = format.format(new Date());
      };
      tick();
      window.setInterval(tick, 30_000);
    }

    const { count, winWidth } = layoutWindows();
    window.addEventListener('resize', () => {
      layoutWindows();
      windows.forEach(clampWindow);
    });

    // A shared link to one section opens just that window; otherwise fill the screen with a few.
    const fromHash = location.hash.slice(1);
    if (windows.has(fromHash)) {
      open(fromHash);
      return;
    }
    const slots = BOOT_WINDOWS.filter((id) => windows.has(id)).slice(0, count);
    if (!slots.length) slots.push(DEFAULT_WINDOW);
    for (let i = slots.length - 1; i >= 0; i -= 1) {
      const win = windows.get(slots[i]);
      if (!win) continue;
      win.style.left = `${CANVAS_LEFT + i * (winWidth + GUTTER)}px`;
      win.style.top = `${CANVAS_TOP}px`;
      open(slots[i]);
    }
    opened = slots.length;
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
