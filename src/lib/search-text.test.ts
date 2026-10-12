import { describe, expect, it } from 'vitest';
import { fold, matches } from './search-text';

describe('search text', () => {
  it('folds Vietnamese accents and đ', () => {
    expect(fold('Đào tạo Viết')).toBe('dao tao viet');
  });

  it('matches every query word regardless of accents', () => {
    expect(matches('viet pro', 'Viết Pro')).toBe(true);
    expect(matches('dao tao', 'Đào tạo & sự kiện')).toBe(true);
    expect(matches('xyz', 'Viết Pro')).toBe(false);
    expect(matches('pro viet', 'Viết Pro')).toBe(true);
    expect(matches('  ', 'Viết Pro')).toBe(true);
  });
});
