import { describe, expect, it } from 'vitest';
import { clearCookieHeader, cookieHeader } from './auth';

describe('session cookie', () => {
  it('is host-only, secure and strict', () => {
    for (const header of [cookieHeader('x'), clearCookieHeader()]) {
      for (const attr of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/']) expect(header).toContain(attr);
      expect(header).not.toContain('Domain');
    }
    expect(cookieHeader('x')).toContain('Max-Age=43200');
    expect(clearCookieHeader()).toContain('Max-Age=0');
  });
});
