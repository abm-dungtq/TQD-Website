// WMO weather codes as returned by Open-Meteo: which background effect to draw and a Vietnamese label.

const within = (code: number, ...ranges: [number, number][]) => ranges.some(([lo, hi]) => code >= lo && code <= hi);

export type WeatherEffect = 'rain' | 'snow' | 'none';

export const effectFor = (code: number): WeatherEffect => {
  if (within(code, [51, 67], [80, 82], [95, 99])) return 'rain';
  if (within(code, [71, 77], [85, 86])) return 'snow';
  return 'none';
};

export const labelFor = (code: number): string => {
  if (code === 0) return 'Trời quang';
  if (within(code, [1, 3])) return 'Có mây';
  if (within(code, [45, 48])) return 'Sương mù';
  if (within(code, [51, 57])) return 'Mưa phùn';
  if (within(code, [61, 67])) return 'Mưa';
  if (within(code, [80, 82])) return 'Mưa rào';
  if (within(code, [71, 77], [85, 86])) return 'Tuyết';
  if (within(code, [95, 99])) return 'Dông';
  return 'Có mây';
};
