// Desktop mascot: changes pose with what the visitor is doing and now and then strolls along the
// bottom of the screen. Poses: wave on arrival, think while ⌘K is open, type while dragging a window,
// point while over the dock, sleep after a minute without input. Each pose image loads the first time it is shown.
// It is also the way into the chat with the website agent: a speech bubble introduces it, a click opens
// the panel (src/scripts/chat-panel.ts, loaded then), and it thinks and types while the agent answers.
import type { ChatSignal } from './chat-panel';
import { play, reducedMotion } from './motion';
import { onPref, prefOn } from './prefs';

type Pose = 'idle' | 'wave' | 'think' | 'type' | 'point' | 'sleep';

const SLEEP_AFTER = 60_000;
const WAVE_FOR = 2000;
const NUDGE_FOR = 4000;
const WALK_SPEED = 90; // px per second: an unhurried stroll
const HOME_SPEED = 900; // hurrying back when the chat opens
const STROLL_MIN = 160;
const STROLL_MAX = 420;
const STRIDE = 'cubic-bezier(.45,0,.55,1)'; // eases in and out without a burst at the start
const MARGIN = 24;
const INTRO_KEY = 'tqd-chat-intro';
const INTRO = 'Tôi là phiên bản Agent của DũngTQ, bạn có thể tìm hiểu các kiến thức về AI từ tôi.';
const NUDGE = 'Hỏi tôi về AI nhé.';
const OFFLINE = 'Agent đang nghỉ, bạn có thể nhắn Zalo.';

const introDismissed = () => {
  try {
    return sessionStorage.getItem(INTRO_KEY) === 'off';
  } catch {
    return false;
  }
};
const dismissIntro = () => {
  try {
    sessionStorage.setItem(INTRO_KEY, 'off');
  } catch {
    /* storage blocked: the bubble just returns on the next visit */
  }
};

const poseUrl = (pose: Pose) => `/mascot/${pose}.webp`;

export const startMascot = (desktop: HTMLElement) => {
  const wrap = desktop.querySelector<HTMLElement>('[data-mascot-wrap]');
  const button = wrap?.querySelector<HTMLButtonElement>('[data-mascot]');
  const tip = wrap?.querySelector<HTMLElement>('[data-mascot-tip]');
  const say = wrap?.querySelector<HTMLElement>('[data-mascot-say]');
  const dismiss = wrap?.querySelector<HTMLButtonElement>('[data-mascot-dismiss]');
  const images = wrap ? [...wrap.querySelectorAll<HTMLImageElement>('[data-mascot-img]')] : [];
  if (!wrap || !button || !tip || !say || !dismiss || images.length !== 2) return;

  const state = { palette: false, dragging: false, dock: false, asleep: false, waving: true, chat: 'close' as ChatSignal };
  let shown: Pose | null = null;
  let front = 0;
  let offset = 0;
  let lastInput = Date.now();
  let running = false;
  let offline = false;
  let waveTimer = 0;
  let tipTimer = 0;
  let walkTimer = 0;
  let sleepTimer = 0;

  const chatOpen = () => state.chat !== 'close';
  const wanted = (): Pose =>
    state.palette || state.chat === 'wait'
      ? 'think'
      : state.chat === 'stream' || state.dragging
        ? 'type'
        : state.dock
          ? 'point'
          : state.asleep
            ? 'sleep'
            : state.waving
              ? 'wave'
              : 'idle';

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

  /** Shows the bubble: the introduction stays until dismissed, a nudge fades after a few seconds. */
  const showTip = (text: string, hold: boolean) => {
    clearTimeout(tipTimer);
    say.textContent = text;
    tip.hidden = false;
    if (!hold) tipTimer = window.setTimeout(() => (tip.hidden = true), NUDGE_FOR);
  };
  const hideTip = () => {
    clearTimeout(tipTimer);
    tip.hidden = true;
  };
  const showIntro = () => {
    if (!chatOpen() && !introDismissed()) showTip(offline ? OFFLINE : INTRO, true);
  };

  const touch = () => {
    lastInput = Date.now();
    if (state.asleep) {
      state.asleep = false;
      update();
      if (!chatOpen() && tip.hidden) showTip(offline ? OFFLINE : NUDGE, false);
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

  /** Where the mascot is drawn right now, including partway through a walk. */
  const drawnX = () => new DOMMatrixReadOnly(getComputedStyle(wrap).transform).m41;

  /** Walks to `x` at a steady pace from wherever it is drawn, so an interrupted walk never jumps. */
  const glide = async (x: number, speed: number, minMs: number, maxMs: number) => {
    const from = drawnX();
    wrap.getAnimations().forEach((a) => a.cancel());
    moveTo(x);
    const distance = Math.abs(offset - from);
    if (distance < 1) return;
    wrap.dataset.dir = offset < from ? 'left' : 'right';
    wrap.dataset.walking = '';
    const duration = Math.min(maxMs, Math.max(minMs, (distance / speed) * 1000));
    await play(wrap, [{ transform: `translateX(${from}px)` }, { transform: `translateX(${offset}px)` }], { duration, easing: STRIDE });
    // A newer walk may have taken over; only the last one ends the stepping.
    if (!wrap.getAnimations().length) delete wrap.dataset.walking;
  };

  const walk = async () => {
    if (!running || reducedMotion() || state.asleep || state.dragging || chatOpen() || document.hidden) return;
    const stroll = STROLL_MIN + Math.random() * (STROLL_MAX - STROLL_MIN);
    // Turn back near either edge so short strolls stay on screen.
    const dir = offset - stroll < -range() ? 1 : offset + stroll > 0 ? -1 : Math.random() < 0.5 ? -1 : 1;
    await glide(offset + dir * stroll, WALK_SPEED, 1200, 6000);
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

  /** The chat panel sits beside the mascot's home corner, so it walks back there first. */
  const goHome = () => glide(0, HOME_SPEED, 250, 900);

  const openChat = () => {
    touch();
    dismissIntro();
    hideTip();
    void goHome();
    import('./chat-panel').then((m) => m.toggleChat(button)).catch(() => {});
  };

  const stop = () => {
    running = false;
    wrap.hidden = true;
    document.documentElement.dataset.mascot = 'off';
    hideTip();
    [waveTimer, tipTimer, walkTimer, sleepTimer].forEach(clearTimeout);
  };

  const start = () => {
    if (running) return;
    running = true;
    wrap.hidden = false;
    document.documentElement.dataset.mascot = 'on';
    showIntro();
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
  button.addEventListener('click', openChat);
  say.addEventListener('click', openChat);
  dismiss.addEventListener('click', () => {
    dismissIntro();
    hideTip();
    button.focus({ preventScroll: true });
  });
  window.addEventListener('tqd:chat', (e) => {
    const signal = (e as CustomEvent<ChatSignal>).detail;
    if (signal === 'offline' || signal === 'online') {
      offline = signal === 'offline';
      return;
    }
    // 'idle' means an answer finished; the panel is still open.
    state.chat = signal === 'idle' ? 'open' : signal;
    if (signal === 'open') hideTip();
    if (signal === 'close') scheduleWalk();
    touch();
    update();
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
  else document.documentElement.dataset.mascot = 'off';
};
