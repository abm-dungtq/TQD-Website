// Plays the featured gallery video beside the profile window (src/components/FeaturedVideo.astro).
// It loops muted while it is on screen and mostly uncovered by windows. "Bật tiếng" plays it once from the
// start with sound, then it returns to the silent loop. Under reduced motion or Save-Data nothing plays until
// the visitor presses the button.
import { reducedMotion } from './motion';

const CHECK_MS = 1000;

const saveData = () => (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;

export const startFeaturedVideo = (desktop: HTMLElement) => {
  const feature = desktop.querySelector<HTMLElement>('[data-feature]');
  const video = feature?.querySelector<HTMLVideoElement>('video');
  const sound = feature?.querySelector<HTMLButtonElement>('[data-feature-sound]');
  const label = feature?.querySelector<HTMLElement>('[data-feature-label]');
  if (!feature || !video || !sound || !label) return;

  const autoplay = !reducedMotion() && !saveData();
  let withSound = false;

  /** True when a visible window covers half of the video or more. */
  const covered = () => {
    const box = feature.getBoundingClientRect();
    const area = box.width * box.height;
    if (!area) return true;
    return [...desktop.querySelectorAll<HTMLElement>('[data-window]:not([hidden])')].some((win) => {
      const r = win.getBoundingClientRect();
      const w = Math.min(box.right, r.right) - Math.max(box.left, r.left);
      const h = Math.min(box.bottom, r.bottom) - Math.max(box.top, r.top);
      return w > 0 && h > 0 && (w * h) / area >= 0.5;
    });
  };

  const sync = () => {
    const wanted = (autoplay || withSound) && !feature.hidden && !document.hidden && !covered();
    if (wanted && video.paused) {
      if (!video.src) video.src = video.dataset.src ?? '';
      video.play().catch(() => {});
    } else if (!wanted && !video.paused) video.pause();
  };

  const setSound = (on: boolean) => {
    withSound = on;
    video.muted = !on;
    video.loop = !on;
    sound.setAttribute('aria-pressed', String(on));
    label.textContent = on ? 'Tắt tiếng' : 'Bật tiếng';
    if (on) video.currentTime = 0;
    sync();
  };

  sound.addEventListener('click', () => setSound(!withSound));
  // With sound it plays once; afterwards it goes back to the silent loop (or the poster).
  video.addEventListener('ended', () => setSound(false));
  document.addEventListener('visibilitychange', sync);
  window.setInterval(sync, CHECK_MS);
  sync();
};
