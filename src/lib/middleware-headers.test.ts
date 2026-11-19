import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:workers', () => ({
  env: { DB: {} },
  waitUntil: () => {},
}));

vi.mock('astro:middleware', () => ({
  defineMiddleware: (fn: unknown) => fn,
}));

import {
  appendDiscoveryLinkHeaders,
  buildDiscoveryLinks,
  markdownTwinPath,
  prefersMarkdown,
  PUBLIC_DISCOVERY_PATHS,
  withHtmlInlineScriptHashes,
  withSecurityHeaders,
} from '../middleware';

describe('markdown negotiation and twin routing helpers', () => {
  it('resolves valid markdown twins and skips non-HTML / admin / api paths', () => {
    expect(markdownTwinPath('/')).toBe('/index.md');
    expect(markdownTwinPath('/ho-so')).toBe('/ho-so.md');
    expect(markdownTwinPath('/shop')).toBe('/shop.md');
    expect(markdownTwinPath('/tai-video')).toBe('/tai-video.md');
    expect(markdownTwinPath('/bai-viet/ai-agent-2026')).toBe('/bai-viet/ai-agent-2026.md');
    expect(markdownTwinPath('/xray/c-a1b2c3d4e5f6')).toBe('/xray/c-a1b2c3d4e5f6.md');
    expect(markdownTwinPath('/xray/c-case-01')).toBeNull();

    expect(markdownTwinPath('/ho-so.md')).toBeNull();
    expect(markdownTwinPath('/rss.xml')).toBeNull();
    expect(markdownTwinPath('/admin')).toBeNull();
    expect(markdownTwinPath('/api/chat')).toBeNull();
  });

  it('detects text/markdown preference from Accept header safely', () => {
    expect(prefersMarkdown('text/markdown')).toBe(true);
    expect(prefersMarkdown('text/markdown, text/html;q=0.8')).toBe(true);
    expect(prefersMarkdown('text/html,application/xhtml+xml')).toBe(false);
    expect(prefersMarkdown(null)).toBe(false);
  });

  it('includes newly added discovery routes in PUBLIC_DISCOVERY_PATHS', () => {
    for (const p of ['/llms.txt', '/.well-known/llms.txt', '/llms-full.txt', '/.well-known/agent.json', '/catalog.json', '/feed.json', '/rss.xml']) {
      expect(PUBLIC_DISCOVERY_PATHS.has(p)).toBe(true);
    }
  });
});

describe('HTTP Link discovery headers and status gating', () => {
  it('attaches llms-txt, rss, feed+json, and markdown twin on 200 public HTML responses', () => {
    const links = buildDiscoveryLinks(new URL('https://tqd.me/ho-so'), 200, false);
    expect(links).toEqual([
      '</llms.txt>; rel="llms-txt"',
      '</rss.xml>; rel="alternate"; type="application/rss+xml"; title="RSS Feed"',
      '</feed.json>; rel="alternate"; type="application/feed+json"; title="JSON Feed"',
      '<https://tqd.me/ho-so.md>; rel="alternate"; type="text/markdown"',
    ]);
  });

  it('omits markdown twin link on 200 .md response while keeping feed/llms links', () => {
    const links = buildDiscoveryLinks(new URL('https://tqd.me/ho-so.md'), 200, false);
    expect(links.some((l) => l.includes('type="text/markdown"'))).toBe(false);
    expect(links).toHaveLength(3);
  });

  it('NEVER attaches Link headers or type="text/markdown" on 404, 301, 500, or private routes', () => {
    expect(buildDiscoveryLinks(new URL('https://tqd.me/khong-co-trang-nay'), 404, false)).toEqual([]);
    expect(buildDiscoveryLinks(new URL('https://tqd.me/video'), 301, false)).toEqual([]);
    expect(buildDiscoveryLinks(new URL('https://tqd.me/ho-so'), 500, false)).toEqual([]);
    expect(buildDiscoveryLinks(new URL('https://tqd.me/admin'), 200, true)).toEqual([]);

    const notFound = withSecurityHeaders(new Response('Not found', { status: 404 }), {
      isPrivate: false,
      isAdmin: false,
      isHttps: true,
      requestUrl: new URL('https://tqd.me/khong-co-trang-nay'),
    });
    expect(notFound.headers.get('Link')).toBeNull();
  });

  it('deduplicates Link headers without dropping existing canonical entries on repeated runs', () => {
    const headers = new Headers({
      Link: '<https://tqd.me/llms.txt>; rel="canonical"',
    });
    const url = new URL('https://tqd.me/.well-known/llms.txt');

    appendDiscoveryLinkHeaders(headers, url, 200, false);
    appendDiscoveryLinkHeaders(headers, url, 200, false);

    const linkValue = headers.get('Link') ?? '';
    expect(linkValue).toContain('<https://tqd.me/llms.txt>; rel="canonical"');
    expect(linkValue.match(/rel="llms-txt"/g)).toHaveLength(1);
    expect(linkValue.match(/application\/rss\+xml/g)).toHaveLength(1);
    expect(linkValue.match(/application\/feed\+json/g)).toHaveLength(1);

    const res1 = withSecurityHeaders(new Response('<html></html>', { status: 200, headers: { 'Content-Type': 'text/html' } }), {
      isPrivate: false,
      isAdmin: false,
      isHttps: true,
      requestUrl: new URL('https://tqd.me/'),
    });
    const res2 = withSecurityHeaders(res1, {
      isPrivate: false,
      isAdmin: false,
      isHttps: true,
      requestUrl: new URL('https://tqd.me/'),
    });
    const finalLink = res2.headers.get('Link') ?? '';
    expect(finalLink.match(/type="text\/markdown"/g)).toHaveLength(1);
    expect(finalLink.match(/rel="llms-txt"/g)).toHaveLength(1);
  });
});

describe('CSP inline script hash deduplication on /404 rewrite', () => {
  it('emits each sha256 hash only once even when withHtmlInlineScriptHashes runs twice', async () => {
    const html = '<!doctype html><html><head></head><body><script>console.log("tqd-test");</script></body></html>';
    const baseRes = withSecurityHeaders(
      new Response(html, {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }),
      {
        isPrivate: false,
        isAdmin: false,
        isHttps: true,
        requestUrl: new URL('https://tqd.me/khong-co-trang-nay'),
      },
    );

    const firstPass = await withHtmlInlineScriptHashes(baseRes, false, true);
    const secondPass = await withHtmlInlineScriptHashes(firstPass, false, true);

    const csp = secondPass.headers.get('Content-Security-Policy') ?? '';
    const hashes = csp.match(/'sha256-[A-Za-z0-9+/=]+'/g) ?? [];
    expect(hashes).toHaveLength(1);
    expect(new Set(hashes).size).toBe(hashes.length);
    expect(secondPass.headers.get('Link')).toBeNull();
  });

  it('uses ADMIN_CSP as clean base when isAdmin is true', async () => {
    const html = '<!doctype html><html><body><script>console.log("admin");</script></body></html>';
    const baseRes = withSecurityHeaders(
      new Response(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }),
      {
        isPrivate: true,
        isAdmin: true,
        isHttps: true,
        requestUrl: new URL('https://tqd.me/admin'),
      },
    );

    const hashedOnce = await withHtmlInlineScriptHashes(baseRes, true, true);
    const hashedTwice = await withHtmlInlineScriptHashes(hashedOnce, true, true);
    const csp = hashedTwice.headers.get('Content-Security-Policy') ?? '';
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp.match(/'sha256-[A-Za-z0-9+/=]+'/g) ?? []).toHaveLength(1);
  });
});
