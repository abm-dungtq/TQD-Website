// Phone home screen: icon taps open the section in a sheet that can be dragged down to close.
// Each sheet is a history entry, so the Back button closes it. Wide screens keep plain links.
import { EASE, play, reducedMotion, SPRING } from './motion';

const NARROW = window.matchMedia('(max-width: 1023px)');
const CLOSE_DISTANCE = 110;
const CLOSE_VELOCITY = 0.5;

const home = document.querySelector<HTMLElement>('[data-m-home]');
const sheet = document.querySelector<HTMLElement>('[data-m-sheet]');
const scrim = document.querySelector<HTMLElement>('[data-m-scrim]');
const title = document.querySelector<HTMLElement>('[data-m-title]');
const body = document.querySelector<HTMLElement>('[data-m-body]');
const pageLink = document.querySelector<HTMLAnchorElement>('[data-m-link]');
const fallback = document.querySelector<HTMLElement>('[data-fallback]');
const skipLink = document.querySelector<HTMLElement>('[data-skip]');
const chatButton = document.querySelector<HTMLElement>('[data-chat-fab]');

if (home && sheet && scrim && title && body && pageLink && fallback) {
  // Outside [data-fallback] so the rest of the page can be made inert while the sheet is open.
  document.body.appendChild(scrim);
  document.body.appendChild(sheet);

  const apps = new Map<string, HTMLAnchorElement>();
  home.querySelectorAll<HTMLAnchorElement>('[data-m-open]').forEach((a) => apps.set(a.dataset.mOpen ?? '', a));
  let current: string | null = null;
  let loadToken = 0;

  const clock = home.querySelector<HTMLElement>('[data-m-clock]');
  const date = home.querySelector<HTMLElement>('[data-m-date]');
  const timeFormat = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Saigon' });
  const dateFormat = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Saigon' });
  const tick = () => {
    const now = new Date();
    if (clock) clock.textContent = timeFormat.format(now);
    if (date) date.textContent = dateFormat.format(now);
  };
  tick();
  window.setInterval(tick, 30_000);

  const load = async (id: string) => {
    const token = ++loadToken;
    body.innerHTML = '<p class="m-loading">Đang tải…</p>';
    try {
      const res = await fetch(`/${id}`);
      if (!res.ok) throw new Error(String(res.status));
      const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      const main = doc.querySelector('main#main');
      if (!main) throw new Error('no main');
      if (token !== loadToken) return;
      // Same-origin HTML rendered by this site; the page's own heading is shown in the sheet header.
      const h1 = main.querySelector('h1');
      (h1?.closest('header') ?? h1)?.remove();
      body.replaceChildren();
      while (main.firstChild) body.appendChild(main.firstChild);
      body.scrollTop = 0;
    } catch {
      if (token === loadToken) location.href = `/${id}`;
    }
  };

  const show = async (id: string) => {
    const app = apps.get(id);
    if (!app) return;
    current = id;
    title.textContent = app.querySelector('.m-label')?.textContent ?? '';
    pageLink.href = `/${id}`;
    sheet.hidden = false;
    scrim.hidden = false;
    fallback.inert = true;
    if (skipLink) skipLink.inert = true;
    if (chatButton) chatButton.inert = true;
    document.documentElement.style.overflow = 'hidden';
    home.classList.add('is-behind');
    sheet.focus({ preventScroll: true });
    const loading = load(id);
    await Promise.all([
      play(sheet, [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], { duration: 380, easing: SPRING }),
      play(scrim, [{ opacity: 0 }, { opacity: 1 }], { duration: 380, easing: EASE }),
    ]);
    await loading;
  };

  const hide = async (fromY = 0) => {
    if (!current) return;
    const id = current;
    current = null;
    home.classList.remove('is-behind');
    await Promise.all([
      play(sheet, [{ transform: `translateY(${fromY}px)` }, { transform: 'translateY(100%)' }], { duration: 260, easing: EASE }),
      play(scrim, [{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: EASE }),
    ]);
    if (current) return;
    sheet.hidden = true;
    scrim.hidden = true;
    sheet.style.transform = '';
    fallback.inert = false;
    if (skipLink) skipLink.inert = false;
    if (chatButton) chatButton.inert = false;
    document.documentElement.style.overflow = '';
    apps.get(id)?.focus({ preventScroll: true });
  };

  /** Closing goes through history so Back and the close button agree. */
  const requestClose = (fromY = 0) => {
    if (history.state?.sheet) {
      pendingFromY = fromY;
      history.back();
    } else void hide(fromY);
  };
  let pendingFromY = 0;

  window.addEventListener('popstate', () => {
    const id = history.state?.sheet as string | undefined;
    if (id && id !== current && NARROW.matches) void show(id);
    else if (!id && current) {
      void hide(pendingFromY);
      pendingFromY = 0;
    }
  });

  apps.forEach((app, id) => {
    app.addEventListener('click', (e) => {
      if (!NARROW.matches || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      history.pushState({ sheet: id }, '', `#${id}`);
      void show(id);
    });
  });

  sheet.querySelector('[data-m-close]')?.addEventListener('click', () => requestClose());
  scrim.addEventListener('click', () => requestClose());
  sheet.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') requestClose();
  });

  // Drag down on the header to close: past CLOSE_DISTANCE or faster than CLOSE_VELOCITY.
  const drag = sheet.querySelector<HTMLElement>('[data-m-drag]');
  drag?.addEventListener('pointerdown', (start) => {
    if ((start.target as Element).closest('a, button')) return;
    drag.setPointerCapture(start.pointerId);
    let dy = 0;
    let last = { y: start.clientY, t: start.timeStamp };
    let velocity = 0;
    const move = (e: PointerEvent) => {
      dy = Math.max(0, e.clientY - start.clientY);
      const dt = e.timeStamp - last.t;
      if (dt > 0) velocity = (e.clientY - last.y) / dt;
      last = { y: e.clientY, t: e.timeStamp };
      sheet.style.transform = `translateY(${dy}px)`;
    };
    const end = () => {
      drag.removeEventListener('pointermove', move);
      drag.removeEventListener('pointerup', end);
      drag.removeEventListener('pointercancel', end);
      if (dy > CLOSE_DISTANCE || velocity > CLOSE_VELOCITY) {
        requestClose(dy);
        return;
      }
      const from = dy;
      sheet.style.transform = '';
      if (from > 0 && !reducedMotion()) {
        void play(sheet, [{ transform: `translateY(${from}px)` }, { transform: 'translateY(0)' }], { duration: 380, easing: SPRING });
      }
    };
    drag.addEventListener('pointermove', move);
    drag.addEventListener('pointerup', end);
    drag.addEventListener('pointercancel', end);
  });

  // Widening to the desktop layout closes the sheet so the page underneath is usable again.
  NARROW.addEventListener('change', (e) => {
    if (!e.matches && current) requestClose();
  });

  // A shared link such as /#san-pham opens that sheet directly.
  const fromHash = location.hash.slice(1);
  if (NARROW.matches && apps.has(fromHash)) {
    // Put the plain home screen underneath, so Back closes the sheet instead of leaving the site.
    history.replaceState(null, '', location.pathname);
    history.pushState({ sheet: fromHash }, '', `#${fromHash}`);
    void show(fromHash);
  }
}
