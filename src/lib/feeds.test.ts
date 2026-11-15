import { describe, expect, it, vi } from 'vitest';
import type { Article, Site } from './content';
import {
  buildJsonFeed,
  buildRssXml,
  escapeXml,
  READ_ONLY_CORS_HEADERS,
  toIsoUtc,
} from './feeds';

const mockSite: Site = {
  person: {
    name: 'Trịnh Quang Dũng',
    handle: 'DũngTQ',
    initials: 'TD',
    role: 'CEO ABM & Tư vấn ứng dụng AI',
    intro: 'Đồng hành cùng doanh nghiệp ứng dụng AI.\n\nĐoạn giới thiệu thứ hai.',
    focus: ['AI Agent', 'Tự động hóa'],
    email: 'dungtq.ceo@gmail.com',
    zalo: 'https://zalo.me/trinhquangdung',
    portrait: '/media/portrait.webp',
    portraitSmall: '/media/portrait-sm.webp',
    portraitAlt: 'Trịnh Quang Dũng',
  },
  links: [],
  topics: { howTo: ['AI Agent'], marketWatch: ['Automation'] },
  sections: [
    { id: 'ho-so', title: 'Hồ sơ', short: 'Giới thiệu', icon: 'user' },
    { id: 'bai-viet', title: 'Bài viết', short: 'Bài viết', icon: 'book' },
  ],
  gallery: [],
};

const mockArticles: Article[] = [
  {
    id: 1,
    slug: 'ai-agent-cho-sme',
    title: 'AI Agent & Vận hành <SME> "2026"',
    summary: 'Tóm tắt bài viết về AI & Agent',
    bodyMd: '# Nội dung\n\nTriển khai AI Agent thực tế.',
    bodyHtml: '<h1>Nội dung</h1><p>Triển khai AI Agent thực tế.</p>',
    tags: ['AI Agent', 'SME & Ops'],
    coverKey: 'covers/agent-cover.webp',
    source: 'original',
    fbOverlap: false,
    version: 1,
    publishedAt: '2026-10-01 08:30:00',
    updatedAt: '2026-10-02T10:00:00Z',
    status: 'published',
  },
  {
    id: 2,
    slug: 'bai-moi-nhat',
    title: 'Bài mới nhất năm 2026',
    summary: '',
    bodyMd: 'Nội dung chi tiết.',
    bodyHtml: '<p>Nội dung chi tiết.</p>',
    tags: ['Workflow'],
    coverKey: '../traversal.png',
    source: 'original',
    fbOverlap: false,
    version: 1,
    publishedAt: '2026-11-10',
    updatedAt: '2026-11-11 12:00:00',
    status: 'published',
  },
  {
    id: 3,
    slug: 'bai-nhap-noi-bo',
    title: 'Bài nháp không được phát hành',
    summary: 'Draft internal',
    bodyMd: 'Bí mật',
    bodyHtml: '<p>Bí mật</p>',
    tags: ['Draft'],
    source: 'original',
    fbOverlap: false,
    version: 1,
    publishedAt: '2026-12-01',
    updatedAt: '2026-12-01',
    status: 'draft',
  },
];

describe('feeds utilities', () => {
  it('normalizes dates with toIsoUtc and handles invalid values safely', () => {
    expect(toIsoUtc('2026-10-01 08:30:00')).toBe('2026-10-01T08:30:00.000Z');
    expect(toIsoUtc('2026-11-10')).toBe('2026-11-10T00:00:00.000Z');
    expect(toIsoUtc('2026-11-10T09:15:30+07:00')).toBe('2026-11-10T02:15:30.000Z');
    expect(toIsoUtc('not-a-date')).toBe('1970-01-01T00:00:00.000Z');
    expect(toIsoUtc(undefined)).toBe('1970-01-01T00:00:00.000Z');
  });

  it('escapes all XML 1.0 entities and strips control characters', () => {
    const escaped = escapeXml(`A & B <tag attr="1" single='2'>\u0000\u0007OK`);
    expect(escaped).toBe('A &amp; B &lt;tag attr=&quot;1&quot; single=&apos;2&apos;&gt;OK');
  });
});

describe('buildRssXml', () => {
  it('renders valid RSS 2.0 with atom self link, vi language, RFC 822 dates, escaped XML, and .md twin links', () => {
    const xml = buildRssXml(mockSite, mockArticles, 'https://tqd.me/');

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">');
    expect(xml).toContain('<atom:link href="https://tqd.me/rss.xml" rel="self" type="application/rss+xml" />');
    expect(xml).toContain('<language>vi</language>');
    expect(xml).toContain(`<pubDate>${new Date('2026-11-10T00:00:00Z').toUTCString()}</pubDate>`);
    expect(xml).toContain(`<pubDate>${new Date('2026-10-01T08:30:00Z').toUTCString()}</pubDate>`);
    expect(xml).toContain('<title>AI Agent &amp; Vận hành &lt;SME&gt; &quot;2026&quot;</title>');
    expect(xml).toContain('https://tqd.me/bai-viet/ai-agent-cho-sme.md');
    expect(xml).toContain('<category>SME &amp; Ops</category>');
    expect(xml).toContain('<enclosure url="https://tqd.me/media/covers/agent-cover.webp" length="0" type="image/webp" />');

    // Draft excluded, path traversal cover rejected, newest article appears first
    expect(xml).not.toContain('bai-nhap-noi-bo');
    expect(xml).not.toContain('traversal.png');
    expect(xml.indexOf('bai-moi-nhat')).toBeLessThan(xml.indexOf('ai-agent-cho-sme'));
  });
});

describe('buildJsonFeed', () => {
  it('renders JSON Feed v1.1 with ISO UTC timestamps, authors, tags, and _tqd markdown_url', () => {
    const feed = buildJsonFeed(mockSite, mockArticles, 'https://tqd.me');

    expect(feed.version).toBe('https://jsonfeed.org/version/1.1');
    expect(feed.home_page_url).toBe('https://tqd.me/');
    expect(feed.feed_url).toBe('https://tqd.me/feed.json');
    expect(feed.language).toBe('vi-VN');
    expect(feed.authors[0]).toEqual({ name: 'Trịnh Quang Dũng (DũngTQ)', url: 'https://tqd.me/ho-so' });
    expect(feed.items).toHaveLength(2);

    const [newest, older] = feed.items;
    expect(newest.id).toBe('https://tqd.me/bai-viet/bai-moi-nhat');
    expect(newest.date_published).toBe('2026-11-10T00:00:00.000Z');
    expect(newest.date_modified).toBe('2026-11-11T12:00:00.000Z');
    expect(newest.image).toBeUndefined();
    expect(newest._tqd).toEqual({
      kind: 'article',
      slug: 'bai-moi-nhat',
      markdown_url: 'https://tqd.me/bai-viet/bai-moi-nhat.md',
    });

    expect(older.image).toBe('https://tqd.me/media/covers/agent-cover.webp');
    expect(older.tags).toEqual(['AI Agent', 'SME & Ops']);
    expect(older._tqd.markdown_url).toBe('https://tqd.me/bai-viet/ai-agent-cho-sme.md');
  });
});

describe('RSS and JSON Feed routes', () => {
  it('serves GET and OPTIONS with expected Content-Type and read-only CORS headers', async () => {
    vi.resetModules();
    vi.doMock('cloudflare:workers', () => ({ env: { DB: {} } }));
    vi.doMock('./content', async () => {
      const actual = await vi.importActual<typeof import('./content')>('./content');
      return {
        ...actual,
        getSite: vi.fn().mockResolvedValue(mockSite),
        listArticles: vi.fn().mockResolvedValue(mockArticles),
      };
    });

    const rssRoute = await import('../pages/rss.xml');
    const jsonRoute = await import('../pages/feed.json');

    const rssRes = await rssRoute.GET({ request: new Request('https://tqd.me/rss.xml') } as never);
    expect(rssRes.status).toBe(200);
    expect(rssRes.headers.get('Content-Type')).toBe('application/rss+xml; charset=utf-8');
    expect(rssRes.headers.get('Access-Control-Allow-Origin')).toBe(READ_ONLY_CORS_HEADERS['Access-Control-Allow-Origin']);
    expect(rssRes.headers.get('Access-Control-Allow-Methods')).toBe(READ_ONLY_CORS_HEADERS['Access-Control-Allow-Methods']);
    expect(await rssRes.text()).toContain('<rss version="2.0"');

    const rssOpt = await rssRoute.OPTIONS({ request: new Request('https://tqd.me/rss.xml', { method: 'OPTIONS' }) } as never);
    expect(rssOpt.status).toBe(204);
    expect(rssOpt.headers.get('Access-Control-Allow-Origin')).toBe('*');

    const jsonRes = await jsonRoute.GET({ request: new Request('https://tqd.me/feed.json') } as never);
    expect(jsonRes.status).toBe(200);
    expect(jsonRes.headers.get('Content-Type')).toBe('application/feed+json; charset=utf-8');
    expect(jsonRes.headers.get('Access-Control-Allow-Origin')).toBe('*');
    const parsed = JSON.parse(await jsonRes.text());
    expect(parsed.version).toBe('https://jsonfeed.org/version/1.1');
    expect(parsed.items).toHaveLength(2);

    const jsonOpt = await jsonRoute.OPTIONS({ request: new Request('https://tqd.me/feed.json', { method: 'OPTIONS' }) } as never);
    expect(jsonOpt.status).toBe(204);
    expect(jsonOpt.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});
