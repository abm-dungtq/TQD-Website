// Shared animation helpers. Every animation goes through play(), which does nothing under reduced motion.

export const EASE = 'cubic-bezier(.2,.8,.2,1)';
export const SPRING = 'cubic-bezier(.2,1.15,.3,1)';

export const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Runs a Web Animation and resolves when it ends or is cancelled; resolves at once under reduced motion. */
export async function play(el: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions): Promise<void> {
  if (reducedMotion()) return;
  try {
    await el.animate(keyframes, options).finished;
  } catch (e) {
    if (!(e instanceof DOMException && e.name === 'AbortError')) throw e;
  }
}
