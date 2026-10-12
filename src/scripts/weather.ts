// Hanoi weather in the desktop menu bar, plus falling rain or snow drawn on a canvas above the
// wallpaper and below the windows. Fetched in the browser so the cached page never shows stale weather.
// `?weather=rain|snow|clear` overrides the effect for testing.
import { effectFor, labelFor, type WeatherEffect } from '../lib/weather-code';
import { onPref, prefOn } from './prefs';
import { reducedMotion } from './motion';

const API =
  'https://api.open-meteo.com/v1/forecast?latitude=21.0285&longitude=105.8542&current=temperature_2m,weather_code,is_day&timezone=Asia%2FBangkok';
const CACHE_KEY = 'tqd-weather';
const CACHE_MS = 30 * 60 * 1000;
const MAX_PARTICLES = { rain: 180, snow: 110 };

interface Current {
  temperature: number;
  code: number;
}

const readCache = (): Current | null => {
  try {
    const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? 'null') as (Current & { at: number }) | null;
    return cached && Date.now() - cached.at < CACHE_MS ? cached : null;
  } catch {
    return null;
  }
};

const fetchCurrent = async (): Promise<Current | null> => {
  const cached = readCache();
  if (cached) return cached;
  try {
    const res = await fetch(API);
    if (!res.ok) return null;
    const data = (await res.json()) as { current?: { temperature_2m?: number; weather_code?: number } };
    const { temperature_2m, weather_code } = data.current ?? {};
    if (typeof temperature_2m !== 'number' || typeof weather_code !== 'number') return null;
    const current = { temperature: temperature_2m, code: weather_code };
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...current, at: Date.now() }));
    } catch {}
    return current;
  } catch {
    return null;
  }
};

interface Particle {
  x: number;
  y: number;
  speed: number;
  size: number;
  phase: number;
}

/** Starts the falling effect on a new canvas inside `host`; returns a function that removes it. */
const startEffect = (host: HTMLElement, effect: Exclude<WeatherEffect, 'none'>) => {
  const canvas = document.createElement('canvas');
  canvas.dataset.weatherFx = effect;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.className = 'desktop-weather-fx';
  host.insertBefore(canvas, host.firstChild);
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => canvas.remove();

  let width = 0;
  let height = 0;
  let particles: Particle[] = [];
  const spawn = (anywhere: boolean): Particle => ({
    x: Math.random() * width,
    y: anywhere ? Math.random() * height : -20,
    speed: effect === 'rain' ? 9 + Math.random() * 6 : 0.6 + Math.random() * 0.9,
    size: effect === 'rain' ? 10 + Math.random() * 10 : 1.5 + Math.random() * 2.5,
    phase: Math.random() * Math.PI * 2,
  });
  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    width = host.clientWidth;
    height = host.clientHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    // Fewer particles on small screens, never more than the cap.
    const count = Math.min(MAX_PARTICLES[effect], Math.round((width * height) / (effect === 'rain' ? 9000 : 14000)));
    particles = Array.from({ length: count }, () => spawn(true));
    canvas.dataset.particles = String(count);
  };

  const rainColor = () =>
    document.documentElement.dataset.theme === 'dark' ? 'rgb(186 230 253 / 0.35)' : 'rgb(30 64 175 / 0.28)';
  const snowColor = () =>
    document.documentElement.dataset.theme === 'dark' ? 'rgb(255 255 255 / 0.85)' : 'rgb(148 163 184 / 0.75)';

  let frame = 0;
  let last = 0;
  const draw = (now: number) => {
    const step = last ? Math.min((now - last) / 16.7, 3) : 1;
    last = now;
    ctx.clearRect(0, 0, width, height);
    if (effect === 'rain') {
      ctx.strokeStyle = rainColor();
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const p of particles) {
        p.y += p.speed * step;
        p.x -= p.speed * 0.18 * step;
        if (p.y > height + 20 || p.x < -20) Object.assign(p, spawn(false), { x: Math.random() * (width + 40) });
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.size * 0.18, p.y - p.size);
      }
      ctx.stroke();
    } else {
      ctx.fillStyle = snowColor();
      ctx.beginPath();
      for (const p of particles) {
        p.y += p.speed * step;
        p.phase += 0.02 * step;
        const x = p.x + Math.sin(p.phase) * 12;
        if (p.y > height + 10) Object.assign(p, spawn(false));
        ctx.moveTo(x + p.size, p.y);
        ctx.arc(x, p.y, p.size, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    frame = requestAnimationFrame(draw);
  };

  const run = () => {
    cancelAnimationFrame(frame);
    last = 0;
    if (!document.hidden) frame = requestAnimationFrame(draw);
  };
  let resizeTimer = 0;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(resize, 150);
  };
  resize();
  run();
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', run);

  return () => {
    cancelAnimationFrame(frame);
    clearTimeout(resizeTimer);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', run);
    canvas.remove();
  };
};

export const startWeather = async (desktop: HTMLElement) => {
  const label = desktop.querySelector<HTMLElement>('[data-weather]');
  const forced = new URLSearchParams(location.search).get('weather');
  const current = await fetchCurrent();

  if (label && current) {
    label.textContent = `Hà Nội ${Math.round(current.temperature)}°C · ${labelFor(current.code)}`;
    label.title = 'Dữ liệu thời tiết: Open-Meteo.com (CC BY 4.0)';
    label.hidden = false;
  }

  const effect: WeatherEffect =
    forced === 'rain' || forced === 'snow' ? forced : forced === 'clear' ? 'none' : current ? effectFor(current.code) : 'none';
  if (effect === 'none') return;

  let stop: (() => void) | null = null;
  const sync = (on: boolean) => {
    if (on && !stop && !reducedMotion()) stop = startEffect(desktop, effect);
    else if (!on && stop) {
      stop();
      stop = null;
    }
  };
  sync(prefOn('tqd-weather-fx'));
  onPref('tqd-weather-fx', sync);
};
