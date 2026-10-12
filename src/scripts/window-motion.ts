// Window animations for the home-page desktop. Timings follow the Phase 6 motion table;
// play() skips all of them under reduced motion, so the state change is simply instant.
import { EASE, play, SPRING } from './motion';

const center = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

const offset = (win: HTMLElement, target: DOMRect) => {
  const from = center(win.getBoundingClientRect());
  const to = center(target);
  return { dx: to.x - from.x, dy: to.y - from.y };
};

/** Grows the window out of the icon that opened it. */
export function animateOpen(win: HTMLElement, fromRect: DOMRect): Promise<void> {
  const { dx, dy } = offset(win, fromRect);
  return play(
    win,
    [
      { transform: `translate(${dx}px, ${dy}px) scale(.16)`, opacity: 0 },
      { transform: 'none', opacity: 1 },
    ],
    { duration: 440, easing: SPRING },
  );
}

export function animateClose(win: HTMLElement): Promise<void> {
  return play(
    win,
    [
      { transform: 'none', opacity: 1 },
      { transform: 'scale(.96)', opacity: 0 },
    ],
    { duration: 170, easing: 'ease-in' },
  );
}

const genie = (dx: number, dy: number): Keyframe[] => [
  { transform: 'none', opacity: 1 },
  { offset: 0.5, transform: `translate(${dx / 2}px, ${dy / 2}px) scale(.6, .5)`, opacity: 0.8 },
  { transform: `translate(${dx}px, ${dy}px) scale(.08, .04)`, opacity: 0.2 },
];

/** Squeezes the window into its dock icon. */
export function animateMinimize(win: HTMLElement, dockRect: DOMRect): Promise<void> {
  const { dx, dy } = offset(win, dockRect);
  return play(win, genie(dx, dy), { duration: 480, easing: EASE });
}

/** The reverse of animateMinimize; the window must already be visible in place. */
export function animateRestore(win: HTMLElement, dockRect: DOMRect): Promise<void> {
  const { dx, dy } = offset(win, dockRect);
  return play(win, genie(dx, dy).reverse().map((k, i, all) => ({ ...k, offset: i / (all.length - 1) })), {
    duration: 480,
    easing: EASE,
  });
}

/** FLIP: applies a size/position change at once, then animates from the old box to the new one. */
export function flip(win: HTMLElement, applyChange: () => void): Promise<void> {
  const first = win.getBoundingClientRect();
  applyChange();
  const last = win.getBoundingClientRect();
  if (!last.width || !last.height) return Promise.resolve();
  const dx = first.left - last.left;
  const dy = first.top - last.top;
  const sx = first.width / last.width;
  const sy = first.height / last.height;
  return play(
    win,
    [
      { transformOrigin: '0 0', transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
      { transformOrigin: '0 0', transform: 'none' },
    ],
    { duration: 260, easing: EASE },
  );
}
