// Moving wallpaper: a short looping video of champagne voile drifting over ivory, drawn under everything
// else on the desktop. The aurora stays underneath and fades out only once the video is playing, so a slow
// or failed load just leaves the aurora. Skipped under reduced motion and Save-Data; paused while the tab is hidden.
import { reducedMotion } from './motion';
import { onPref, prefOn } from './prefs';

// Served from R2 through /media, which answers byte-range requests (Safari will not play a video without
// them). The source file is src/assets/wallpaper-silk.mp4; see README for re-uploading it.
const SRC = '/media/2026/10/silk-wallpaper.mp4';

const saveData = () => (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;

export const startWallpaper = (desktop: HTMLElement) => {
  if (reducedMotion() || saveData()) return;
  let video: HTMLVideoElement | null = null;

  const sync = () => {
    if (!video) return;
    if (document.hidden) video.pause();
    else void video.play().catch(() => {});
  };

  const start = () => {
    if (video) return;
    video = document.createElement('video');
    video.className = 'desktop-wallpaper';
    video.setAttribute('aria-hidden', 'true');
    Object.assign(video, { muted: true, loop: true, playsInline: true, preload: 'auto', disablePictureInPicture: true });
    video.addEventListener('playing', () => (desktop.dataset.wallpaper = 'video'), { once: true });
    video.src = SRC;
    desktop.insertBefore(video, desktop.firstChild);
    sync();
  };

  const stop = () => {
    delete desktop.dataset.wallpaper;
    video?.pause();
    video?.remove();
    video = null;
  };

  document.addEventListener('visibilitychange', sync);
  onPref('tqd-wallpaper', (on) => (on ? start() : stop()));
  if (prefOn('tqd-wallpaper')) start();
};
