import { describe, expect, it } from 'vitest';
import {
  detectBot,
  detectDevice,
  normalizeRefHost,
  normalizeTqdPath,
  normalizeUtm,
  sanitizePayload,
} from './normalize';

describe('normalizeTqdPath & sanitizePayload (tqd.me)', () => {
  it('normalizes >= 20 URLs and strictly excludes /admin*, /api*, /media*, and non-HTML files', () => {
    const cases: Array<{
      input: string;
      expected: { section: string; pathTpl: string; path: string } | null;
    }> = [
      { input: '/', expected: { section: 'home', pathTpl: '/', path: '/' } },
      { input: '/?utm_source=facebook&fbclid=IwAR123', expected: { section: 'home', pathTpl: '/', path: '/' } },
      { input: '/ho-so#kinh-nghiem', expected: { section: 'home', pathTpl: '/ho-so', path: '/ho-so' } },
      { input: '/san-pham?ref=nav', expected: { section: 'tools', pathTpl: '/san-pham', path: '/san-pham' } },
      { input: '/thu-vien/', expected: { section: 'gallery', pathTpl: '/thu-vien', path: '/thu-vien' } },
      { input: '/video-ai?v=123', expected: { section: 'gallery', pathTpl: '/video-ai', path: '/video-ai' } },
      { input: '/bai-viet', expected: { section: 'articles', pathTpl: '/bai-viet', path: '/bai-viet' } },
      {
        input: '/bai-viet/dung-ai-viet-bao-cao?utm_source=facebook&fbclid=abc',
        expected: {
          section: 'articles',
          pathTpl: '/bai-viet/[slug]',
          path: '/bai-viet/dung-ai-viet-bao-cao',
        },
      },
      {
        input: 'https://tqd.me/bai-viet/tu-dong-hoa-doanh-nghiep#phan-2',
        expected: {
          section: 'articles',
          pathTpl: '/bai-viet/[slug]',
          path: '/bai-viet/tu-dong-hoa-doanh-nghiep',
        },
      },
      { input: '/lien-he', expected: { section: 'other', pathTpl: '/lien-he', path: '/lien-he' } },
      { input: '/tai-video#test', expected: { section: 'tools', pathTpl: '/tai-video', path: '/tai-video' } },
      { input: '/quyen-rieng-tu', expected: { section: 'legal', pathTpl: '/quyen-rieng-tu', path: '/quyen-rieng-tu' } },
      // Excluded admin, API, media, and static/markdown routes:
      { input: '/admin', expected: null },
      { input: '/admin/login', expected: null },
      { input: '/admin/thong-ke?range=7d', expected: null },
      { input: '/api/t', expected: null },
      { input: '/api/v1/articles', expected: null },
      { input: '/api/v1/admin/analytics-rollup', expected: null },
      { input: '/media/avatar.webp', expected: null },
      { input: '/sitemap.xml', expected: null },
      { input: '/llms.txt', expected: null },
      { input: '/index.md', expected: null },
      { input: '/bai-viet/INVALID_UPPERCASE_SLUG', expected: null },
      { input: '/khong-ton-tai', expected: null },
    ];

    expect(cases.length).toBeGreaterThanOrEqual(24);
    for (const c of cases) {
      const actual = normalizeTqdPath(c.input);
      expect(actual, `Failed for input: ${c.input}`).toEqual(c.expected);
      if (actual) {
        expect(actual.path).not.toContain('?');
        expect(actual.path).not.toContain('#');
      }
    }
  });

  it('rejects unknown payload keys, oversized payloads (> 1024 bytes), and /admin paths in sanitizePayload', () => {
    const valid = sanitizePayload({
      e: 'page_view',
      p: '/bai-viet/dung-ai-viet-bao-cao?utm_source=zalo',
      r: 'https://www.google.com/search?q=tqd',
      u: 'zalo',
      s: 'abcd1234efgh5678',
      pv: 'pv1234567890',
      ms: 4200,
      sc: 75,
      wb: false,
    });
    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.data.path).toBe('/bai-viet/dung-ai-viet-bao-cao');
      expect(valid.data.pathTpl).toBe('/bai-viet/[slug]');
      expect(valid.data.section).toBe('articles');
      expect(valid.data.refHost).toBe('google.com');
      expect(valid.data.utm).toBe('zalo');
    }

    const unknownKey = sanitizePayload({
      e: 'page_view',
      p: '/',
      email: 'secret@example.com',
    });
    expect(unknownKey.ok).toBe(false);

    const adminAttempt = sanitizePayload({
      e: 'page_view',
      p: '/admin/thong-ke',
    });
    expect(adminAttempt.ok).toBe(false);

    const oversized = sanitizePayload({
      e: 'page_view',
      p: '/',
      r: 'https://example.com/' + 'a'.repeat(1100),
    });
    expect(oversized.ok).toBe(false);
    if (!oversized.ok) {
      expect(oversized.error).toBe('payload_too_large');
    }
  });

  it('normalizes referrer, utm, bot, and device accurately', () => {
    expect(normalizeRefHost('https://www.tqd.me/bai-viet', 'tqd.me')).toBe('direct');
    expect(normalizeRefHost('https://tuvi.tqd.me/chart', 'tqd.me')).toBe('tuvi.tqd.me');
    expect(normalizeUtm('fb_ads')).toBe('facebook');
    expect(detectBot('Mozilla/5.0 (compatible; Googlebot/2.1)', false)).toBe('1');
    expect(detectDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('mobile');
  });
});
