import { describe, expect, it, vi } from 'vitest';

vi.mock('astro:middleware', () => ({ defineMiddleware: (fn: unknown) => fn }));

import { withSecurityHeaders } from '../middleware';

const html = () => new Response('<h1>x</h1>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
const json = () => new Response('{}', { headers: { 'Content-Type': 'application/json' } });

describe('withSecurityHeaders', () => {
  it('stamps the baseline headers and HSTS only over HTTPS', () => {
    const secure = withSecurityHeaders(html(), { isHttps: true });
    expect(secure.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(secure.headers.get('X-Frame-Options')).toBe('DENY');
    expect(secure.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(secure.headers.get('Permissions-Policy')).toContain('camera=()');
    expect(secure.headers.get('Strict-Transport-Security')).toContain('max-age=31536000');

    const plain = withSecurityHeaders(html(), { isHttps: false });
    expect(plain.headers.get('Strict-Transport-Security')).toBeNull();
  });

  it('adds CSP only to HTML and preserves status/body', async () => {
    const page = withSecurityHeaders(html(), { isHttps: true });
    expect(page.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
    expect(await page.text()).toBe('<h1>x</h1>');

    const api = withSecurityHeaders(json(), { isHttps: true });
    expect(api.headers.get('Content-Security-Policy')).toBeNull();
  });

  it('keeps redirect status and location intact', () => {
    const redirect = new Response(null, { status: 301, headers: { Location: '/thu-vien' } });
    const stamped = withSecurityHeaders(redirect, { isHttps: true });
    expect(stamped.status).toBe(301);
    expect(stamped.headers.get('Location')).toBe('/thu-vien');
  });
});
