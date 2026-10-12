// Desktop mascot: changes pose with what the visitor is doing and now and then strolls along the
// bottom of the screen. Poses: wave on arrival, think while ⌘K is open, type while dragging a window,
// point while over the dock, sleep after a minute without input. Each pose image loads the first time it is shown.
import { EASE, play, reducedMotion } from './motion';
import { onPref, prefOn } from './prefs';

type Pose = 'idle' | 'wave' | 'think' | 'type' | 'point' | 'sleep';

const SLEEP_AFTER = 60_000;
const WAVE_FOR = 2000;
const TIP_FOR = 4000;
const WALK_MS = 2400;
const MARGIN = 24;
const TIPS = [
  'Bấm Ctrl K (⌘K trên Mac) để tìm nhanh.',
  'Kéo thanh tiêu đề để di chuyển cửa sổ.',
  'Bấm Tất cả cửa sổ để xem Exposé.',
  'Đọc bài mới ở mục Bài viết.',
];

const poseUrl = (pose: Pose) => `/mascot/${pose}.webp`;

export const startMascot = (desktop: HTMLElement) => {
  const wrap = desktop.querySelector<HTMLElement>('[data-mascot-wrap]');
  const button = wrap?.querySelector<HTMLButtonElement>('[data-mascot]');
  const tip = wrap?.querySelector<HTMLElement>('[data-mascot-tip]');
  const images = wrap ? [...wrap.querySelectorAll<HTMLImageElement>('[data-mascot-img]')] : [];
  if (!wrap || !button || !tip || images.length !== 2) return;

  const state = { palette: false, dragging: false, dock: false, asleep: false, waving: true };
  let shown: Pose | null = null;
  let front = 0;
  let offset = 0;
  let lastInput = Date.now();
  let tipIndex = 0;
  let running = false;
  let waveTimer = 0;
  let tipTimer = 0;
  let walkTimer = 0;
  let sleepTimer = 0;

  const wanted = (): Pose =>
    state.palette ? 'think' : state.dragging ? 'type' : state.dock ? 'point' : state.asleep ? 'sleep' : state.waving ? 'wave' : 'idle';

  /** Loads the next pose into the hidden image, then cross-fades to it (instantly under reduced motion). */
  const show = async (pose: Pose) => {
    if (pose === shown) return;
    shown = pose;
    button.dataset.pose = pose;
    const next = images[1 - front];
    next.src = poseUrl(pose);
    try {
      await next.decode();
    } catch {
      return;
    }
    if (shown !== pose) return;
    images[front].classList.remove('is-front');
    next.classList.add('is-front');
    front = 1 - front;
  };
  const update = () => void show(wanted());

  const touch = () => {
    lastInput = Date.now();
    if (state.asleep) {
      state.asleep = false;
      update();
    }
  };

  const range = () => Math.max(0, window.innerWidth - 128 - MARGIN * 2);
  /** Moves the mascot to `offset`; on the left half of the screen the tip opens to the right so it stays in view. */
  const moveTo = (x: number) => {
    offset = Math.min(0, Math.max(x, -range()));
    wrap.style.transform = `translateX(${offset}px)`;
    wrap.dataset.tip = offset < -range() / 2 ? 'right' : 'left';
  };
  const place = () => moveTo(offset);

  const walk = async () => {
    if (!running || reducedMotion() || state.asleep || state.dragging || document.hidden) return;
    const from = offset;
    const to = -Math.round(Math.random() * range());
    if (Math.abs(to - from) < 40) return;
    wrap.dataset.dir = to < from ? 'left' : 'right';
    moveTo(to);
    await play(wrap, [{ transform: `translateX(${from}px)` }, { transform: `translateX(${offset}px)` }], {
      duration: WALK_MS,
      easing: EASE,
    });
  };

  const scheduleWalk = () => {
    clearTimeout(walkTimer);
    if (!running || document.hidden || reducedMotion()) return;
    walkTimer = window.setTimeout(async () => {
      await walk();
      scheduleWalk();
    }, 14_000 + Math.random() * 12_000);
  };

  const scheduleSleep = () => {
    clearTimeout(sleepTimer);
    if (!running || document.hidden) return;
    sleepTimer = window.setTimeout(() => {
      if (Date.now() - lastInput >= SLEEP_AFTER) {
        state.asleep = true;
        update();
      }
      scheduleSleep();
    }, Math.max(1000, SLEEP_AFTER - (Date.now() - lastInput)));
  };

  const showTip = () => {
    tip.textContent = TIPS[tipIndex % TIPS.length];
    tipIndex += 1;
    clearTimeout(tipTimer);
    tipTimer = window.setTimeout(() => (tip.textContent = ''), TIP_FOR);
  };

  const stop = () => {
    running = false;
    wrap.hidden = true;
    tip.textContent = '';
    [waveTimer, tipTimer, walkTimer, sleepTimer].forEach(clearTimeout);
  };

  const start = () => {
    if (running) return;
    running = true;
    wrap.hidden = false;
    lastInput = Date.now();
    state.asleep = false;
    state.waving = true;
    place();
    update();
    waveTimer = window.setTimeout(() => {
      state.waving = false;
      update();
    }, WAVE_FOR);
    scheduleWalk();
    scheduleSleep();
  };

  window.addEventListener('tqd:palette', (e) => {
    state.palette = (e as CustomEvent<string>).detail === 'open';
    touch();
    update();
  });
  window.addEventListener('tqd:drag', (e) => {
    state.dragging = (e as CustomEvent<string>).detail === 'start';
    update();
  });
  const dock = desktop.querySelector<HTMLElement>('.desktop-dock');
  dock?.addEventListener('pointerenter', () => {
    state.dock = true;
    update();
  });
  dock?.addEventListener('pointerleave', () => {
    state.dock = false;
    update();
  });
  for (const type of ['pointermove', 'pointerdown', 'keydown', 'wheel'] as const) {
    window.addEventListener(type, touch, { passive: true });
  }
  button.addEventListener('click', () => {
    touch();
    showTip();
  });
  document.addEventListener('visibilitychange', () => {
    if (!running) return;
    if (document.hidden) [walkTimer, sleepTimer].forEach(clearTimeout);
    else {
      scheduleWalk();
      scheduleSleep();
    }
  });
  window.addEventListener('resize', place);

  onPref('tqd-mascot', (on) => (on ? start() : stop()));
  if (prefOn('tqd-mascot')) start();
};
