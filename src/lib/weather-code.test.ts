import { describe, expect, it } from 'vitest';
import { effectFor, labelFor } from './weather-code';

describe('weather code', () => {
  it('maps codes to background effects', () => {
    expect(effectFor(61)).toBe('rain');
    expect(effectFor(95)).toBe('rain');
    expect(effectFor(73)).toBe('snow');
    expect(effectFor(0)).toBe('none');
    expect(effectFor(3)).toBe('none');
  });

  it('labels codes in Vietnamese', () => {
    expect(labelFor(0)).toBe('Trời quang');
    expect(labelFor(2)).toBe('Có mây');
    expect(labelFor(45)).toBe('Sương mù');
    expect(labelFor(53)).toBe('Mưa phùn');
    expect(labelFor(63)).toBe('Mưa');
    expect(labelFor(81)).toBe('Mưa rào');
    expect(labelFor(86)).toBe('Tuyết');
    expect(labelFor(96)).toBe('Dông');
  });
});
