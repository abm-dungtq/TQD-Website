// Privacy-first first-party analytics beacon (/api/t), header nav scroll-cue updates,
// and CSP-safe media fallback handling (zero inline scripts or inline event attributes).

function setupHeaderNavScroll() {
  const nav = document.querySelector<HTMLElement>('.site-nav');
  if (!nav) return;

  const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
  if (active && nav.scrollWidth > nav.clientWidth) {
    nav.scrollLeft = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
  }

  const syncScrollCue = () => {
    const overflow = nav.scrollWidth - nav.clientWidth > 4;
    if (!overflow) {
      nav.dataset.scrollPos = 'none';
      return;
    }
    const atStart = nav.scrollLeft <= 6;
    const atEnd = nav.scrollLeft + nav.clientWidth >= nav.scrollWidth - 6;
    nav.dataset.scrollPos = atStart ? 'start' : atEnd ? 'end' : 'middle';
  };

  syncScrollCue();
  nav.addEventListener('scroll', syncScrollCue, { passive: true });
  window.addEventListener('resize', syncScrollCue, { passive: true });
}

function setupMediaFallback() {
  const applyFallback = (img: HTMLImageElement) => {
    if (img.dataset.fallbackApplied === '1') return;
    const src = img.getAttribute('src') || '';
    if (!src.startsWith('/media/')) return;
    img.dataset.fallbackApplied = '1';

    const label = img.getAttribute('alt') || 'Tư liệu hình ảnh';
    const card = document.createElement('div');
    card.className = 'media-fallback';
    card.setAttribute('role', 'img');
    card.setAttribute('aria-label', label);

    const monogram = document.createElement('span');
    monogram.className = 'media-fallback-mark';
    monogram.textContent = 'TQD';

    const caption = document.createElement('span');
    caption.className = 'media-fallback-caption';
    caption.textContent = label;

    card.appendChild(monogram);
    card.appendChild(caption);
    img.replaceWith(card);
  };

  // Catch images that already failed before module execution
  document.querySelectorAll<HTMLImageElement>('img[src^="/media/"]').forEach((img) => {
    if (img.complete && img.naturalWidth === 0) applyFallback(img);
  });

  // Capture-phase error listener handles future broken /media/* images without inline onerror=""
  document.addEventListener(
    'error',
    (ev) => {
      if (ev.target instanceof HTMLImageElement) {
        applyFallback(ev.target);
      }
    },
    true,
  );
}

function setupAnalyticsBeacon() {
  try {
    if (localStorage.getItem('tqd_notrack') === '1') return;
  } catch {
    // storage blocked
  }

  const rnd = (n: number): string => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < n; i++) out += chars[(Math.random() * chars.length) | 0];
    return out;
  };

  const getSid = (): string => {
    try {
      const now = Date.now();
      const raw = sessionStorage.getItem('tqd_sid');
      if (raw) {
        const parsed = JSON.parse(raw) as { id?: string; t?: number };
        if (parsed && parsed.id && typeof parsed.t === 'number' && now - parsed.t < 1_800_000) {
          sessionStorage.setItem('tqd_sid', JSON.stringify({ id: parsed.id, t: now }));
          return parsed.id;
        }
      }
      const id = rnd(16);
      sessionStorage.setItem('tqd_sid', JSON.stringify({ id, t: now }));
      return id;
    } catch {
      return rnd(16);
    }
  };

  let pv = rnd(12);
  let sid = getSid();
  let activeStart = Date.now();
  let lastAct = activeStart;
  let accMs = 0;
  let maxSc = 0;
  let lastSentSc = -1;
  let isVisible = document.visibilityState === 'visible';

  const send = (payload: Record<string, unknown>, beacon: boolean) => {
    const body = JSON.stringify(payload);
    try {
      if (beacon && navigator.sendBeacon) {
        navigator.sendBeacon('/api/t', new Blob([body], { type: 'application/json' }));
        return;
      }
      fetch('/api/t', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    } catch {
      // network unavailable
    }
  };

  let utmSource = '';
  try {
    utmSource = new URLSearchParams(location.search).get('utm_source') || '';
  } catch {
    // ignore malformed query
  }

  send(
    {
      e: 'page_view',
      p: location.pathname,
      r: document.referrer || '',
      u: utmSource,
      s: sid,
      pv,
      wb: Boolean(navigator.webdriver),
    },
    false,
  );

  const onAct = () => {
    const now = Date.now();
    if (isVisible) {
      if (now - lastAct <= 30_000) accMs += now - activeStart;
      activeStart = now;
    }
    lastAct = now;
  };

  const onScroll = () => {
    onAct();
    const el = document.documentElement;
    const h = el.scrollHeight - el.clientHeight;
    const pct = h > 0 ? Math.min(100, Math.round((window.scrollY / h) * 100)) : 100;
    if (pct > maxSc) maxSc = pct;
  };

  (['pointerdown', 'keydown', 'touchstart'] as const).forEach((ev) => {
    window.addEventListener(ev, onAct, { passive: true });
  });
  window.addEventListener('scroll', onScroll, { passive: true });

  const flush = () => {
    const now = Date.now();
    if (isVisible && now - lastAct <= 30_000) {
      accMs += now - activeStart;
    }
    activeStart = now;
    const ms = Math.min(1_800_000, Math.max(0, Math.round(accMs)));
    accMs = 0;
    // Skip empty duplicate flushes (e.g. pagehide immediately following visibilitychange -> hidden)
    if (ms < 250 && (maxSc === 0 || maxSc === lastSentSc)) return;
    lastSentSc = maxSc;
    send(
      {
        e: 'page_end',
        p: location.pathname,
        s: sid,
        pv,
        ms,
        sc: maxSc,
        wb: Boolean(navigator.webdriver),
      },
      true,
    );
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flush();
      isVisible = false;
    } else {
      isVisible = true;
      activeStart = Date.now();
      lastAct = activeStart;
    }
  });

  window.addEventListener('pagehide', flush);

  window.addEventListener('pageshow', (ev) => {
    if (ev.persisted) {
      pv = rnd(12);
      sid = getSid();
      accMs = 0;
      maxSc = 0;
      lastSentSc = -1;
      isVisible = document.visibilityState === 'visible';
      activeStart = Date.now();
      lastAct = activeStart;
      send(
        {
          e: 'page_view',
          p: location.pathname,
          r: document.referrer || '',
          u: utmSource,
          s: sid,
          pv,
          wb: Boolean(navigator.webdriver),
        },
        false,
      );
    }
  });
}

setupHeaderNavScroll();
setupMediaFallback();
setupAnalyticsBeacon();
