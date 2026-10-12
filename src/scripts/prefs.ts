// On/off switches for optional desktop effects (mascot, weather), saved in localStorage and on by default.
// Changes are announced with a `tqd:pref` window event so the effect modules can react without a reload.

export type PrefKey = 'tqd-mascot' | 'tqd-weather-fx';

export const prefOn = (key: PrefKey) => {
  try {
    return localStorage.getItem(key) !== 'off';
  } catch {
    return true;
  }
};

export const setPref = (key: PrefKey, on: boolean) => {
  try {
    localStorage.setItem(key, on ? 'on' : 'off');
  } catch {}
  window.dispatchEvent(new CustomEvent('tqd:pref', { detail: { key, on } }));
};

export const onPref = (key: PrefKey, listener: (on: boolean) => void) => {
  window.addEventListener('tqd:pref', (event) => {
    const detail = (event as CustomEvent<{ key: PrefKey; on: boolean }>).detail;
    if (detail.key === key) listener(detail.on);
  });
};
