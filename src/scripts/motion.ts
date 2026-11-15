// Shared animation helpers. Every animation goes through play(), which does nothing under reduced motion.

export const EASE = 'cubic-bezier(.2,.8,.2,1)';
export const SPRING = 'cubic-bezier(.2,1.15,.3,1)';

export const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** True when reduced motion, headless automation (`navigator.webdriver`), or `?reduced=1` requests low-power playback. */
export const lowPowerMotion = (): boolean =>
  reducedMotion() ||
  navigator.webdriver === true ||
  new URLSearchParams(window.location.search).get('reduced') === '1';

/** Runs a Web Animation and resolves when it ends or is cancelled; resolves at once under low-power motion. */
export async function play(el: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions): Promise<void> {
  if (lowPowerMotion()) return;
  try {
    await el.animate(keyframes, options).finished;
  } catch (e) {
    if (!(e instanceof DOMException && e.name === 'AbortError')) throw e;
  }
}
