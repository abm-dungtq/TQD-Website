import { describe, expect, it, vi } from 'vitest';
import {
  buildPublicCatalog,
  sanitizeCatalogLinks,
  sanitizeCatalogUrl,
  type CuratedShareSummary,
} from './catalog';
import type { SiteData } from './content';

const sampleSiteData: SiteData = {
  site: {
    person: {
      name: 'Trịnh Quang Dũng',
      handle: 'DũngTQ',
      initials: 'TD',
      role: 'CEO ABM & Tư vấn AI',
      intro: 'Xây dựng hệ thống AI ứng dụng.',
      focus: ['AI Agent', 'Automation'],
      email: 'dungtq.ceo@gmail.com',
      zalo: 'https://zalo.me/trinhquangdung',
      portrait: '/media/portrait.webp',
      portraitSmall: '/media/portrait-sm.webp',
      portraitAlt: 'Trịnh Quang Dũng',
    },
    links: [],
    topics: { howTo: ['AI Agent'], marketWatch: ['SaaS'] },
    sections: [
      { id: 'ho-so', title: 'Hồ sơ', short: 'Hồ sơ', icon: 'user' },
      { id: 'san-pham', title: 'Sản phẩm', short: 'Sản phẩm', icon: 'box' },
    ],
    gallery: [],
  },
  articles: [
    {
      id: 1,
      slug: 'huong-dan-mcp',
      title: 'Hướng dẫn MCP thực chiến',
      summary: 'Tổng quan giao thức MCP',
      bodyMd: 'Nội dung',
      bodyHtml: '<p>Nội dung</p>',
      tags: ['MCP', 'Agent'],
      coverKey: 'articles/mcp.webp',
      source: 'original',
      fbOverlap: false,
      version: 1,
      publishedAt: '2026-10-15 00:00:00',
      updatedAt: '2026-10-16 00:00:00',
      status: 'published',
    },
    {
      id: 2,
      slug: 'bai-nhap',
      title: 'Bài nháp',
      summary: 'Ẩn',
      bodyMd: 'Ẩn',
      bodyHtml: '<p>Ẩn</p>',
      tags: [],
      source: 'original',
      fbOverlap: false,
      version: 1,
      publishedAt: '2026-10-17',
      updatedAt: '2026-10-17',
      status: 'draft',
    },
  ],
  products: [
    {
      id: 10,
      kind: 'product',
      title: 'ABM Workflow Kit',
      date: '10/10/2026',
      summary: 'Bộ công cụ tự động hóa vận hành.',
      tags: ['Automation', 'AI'],
      coverKey: 'products/kit.png',
      links: [
        { label: 'Trang chủ', href: 'https://lp.abmedu.vn' },
        { label: 'Nội bộ', href: '/tai-video' },
        { label: 'XSS Link', href: 'javascript:alert(1)' },
        { label: 'Data URI', href: 'data:text/html,<script>alert(1)</script>' },
      ],
      sort: 1,
      visible: true,
    },
    {
      id: 11,
      kind: 'product',
      title: 'Sản phẩm ẩn',
      date: '11/10/2026',
      summary: 'Không hiển thị công khai.',
      tags: [],
      links: [{ label: 'Hidden', href: 'https://example.com' }],
      sort: 2,
      visible: false,
    },
  ],
  videos: [
    {
      id: 20,
      kind: 'video',
      title: 'Demo AI Agent chốt đơn',
      date: '25/09–05/10/2026',
      summary: 'Quy trình xử lý tin nhắn tự động.',
      tags: ['Video AI'],
      tiktokId: '7412345678901234567',
      links: [{ label: 'Unsafe', href: 'vbscript:msgbox(1)' }],
      sort: 1,
      visible: true,
    },
    {
      id: 21,
      kind: 'video',
      title: 'Video ẩn',
      date: '01/10/2026',
      summary: 'Ẩn',
      tags: [],
      sort: 2,
      visible: false,
    },
  ],
};

const sampleShares: CuratedShareSummary[] = [
  {
    shareId: 'c-case-bds',
    title: 'Kịch bản chốt lịch xem nhà 45s',
    platformLabel: 'TikTok',
    formatKey: 'tiktok-script',
    industry: 'Bất động sản',
    vietProScore: 94,
    createdAt: 1760000000,
  },
  {
    shareId: 'g-private-guest-123',
    title: 'Guest share MUST be excluded',
    platformLabel: 'TikTok',
    formatKey: 'tiktok-script',
    industry: 'Tài chính',
    vietProScore: 88,
    createdAt: 1760000100,
  },
];

describe('catalog URL sanitization', () => {
  it('allows http:, https:, and single-slash site-relative URLs while blocking dangerous schemes', () => {
    expect(sanitizeCatalogUrl('https://lp.abmedu.vn/demo', 'https://tqd.me')).toBe('https://lp.abmedu.vn/demo');
    expect(sanitizeCatalogUrl('http://example.com/a', 'https://tqd.me')).toBe('http://example.com/a');
    expect(sanitizeCatalogUrl('/tai-video', 'https://tqd.me')).toBe('https://tqd.me/tai-video');

    expect(sanitizeCatalogUrl('javascript:alert(1)', 'https://tqd.me')).toBeNull();
    expect(sanitizeCatalogUrl('JAVASCRIPT:alert(1)', 'https://tqd.me')).toBeNull();
    expect(sanitizeCatalogUrl('data:text/html,<h1>x</h1>', 'https://tqd.me')).toBeNull();
    expect(sanitizeCatalogUrl('vbscript:msgbox(1)', 'https://tqd.me')).toBeNull();
    expect(sanitizeCatalogUrl('mailto:test@example.com', 'https://tqd.me')).toBeNull();
    expect(sanitizeCatalogUrl('//evil.example/phish', 'https://tqd.me')).toBeNull();
    expect(sanitizeCatalogUrl('https://tqd.me/bad\nurl', 'https://tqd.me')).toBeNull();
  });

  it('filters unsafe links[] entries cleanly', () => {
    const clean = sanitizeCatalogLinks(
      [
        { label: 'OK', href: 'https://tqd.me/ho-so' },
        { label: 'Relative', href: '/san-pham' },
        { label: 'XSS', href: 'javascript:void(0)' },
        { label: 'Data', href: 'data:image/svg+xml,<svg/>' },
      ],
      'https://tqd.me',
    );
    expect(clean).toEqual([
      { label: 'OK', url: 'https://tqd.me/ho-so' },
      { label: 'Relative', url: 'https://tqd.me/san-pham' },
    ]);
  });
});

describe('buildPublicCatalog', () => {
  it('assembles schemaVersion 1.0 catalog with articles, products, /tai-video, videos, and strictly c-* curated shares', () => {
    const catalog = buildPublicCatalog({
      siteOrigin: 'https://tqd.me/',
      data: sampleSiteData,
      curatedShares: sampleShares,
      contentVersion: 42,
      generatedAt: '2026-11-15T08:00:00Z',
    });

    expect(catalog.schemaVersion).toBe('1.0');
    expect(catalog.generatedAt).toBe('2026-11-15T08:00:00.000Z');
    expect(catalog.siteOrigin).toBe('https://tqd.me');
    expect(catalog.contentVersion).toBe(42);
    expect(catalog.owner.name).toBe('Trịnh Quang Dũng');
    expect(catalog.endpoints.agentCard).toBe('https://tqd.me/.well-known/agent.json');
    expect(catalog.endpoints.rssXml).toBe('https://tqd.me/rss.xml');
    expect(catalog.endpoints.feedJson).toBe('https://tqd.me/feed.json');
    expect(catalog.endpoints.searchJson).toBe('https://tqd.me/search.json');

    const ids = catalog.items.map((item) => item.id);
    expect(ids).toEqual([
      'article:huong-dan-mcp',
      'product:10',
      'tool:tai-video',
      'video:20',
      'showcase:c-case-bds',
    ]);

    const product = catalog.items.find((i) => i.id === 'product:10');
    expect(product?.publishedAt).toBe('2026-10-10T00:00:00.000Z');
    expect(product?.links).toEqual([
      { label: 'Trang chủ', url: 'https://lp.abmedu.vn/' },
      { label: 'Nội bộ', url: 'https://tqd.me/tai-video' },
    ]);

    const video = catalog.items.find((i) => i.id === 'video:20');
    expect(video?.publishedAt).toBeNull();
    expect(video?.links).toEqual([
      { label: 'TikTok', url: 'https://www.tiktok.com/player/v1/7412345678901234567' },
    ]);

    const showcase = catalog.items.find((i) => i.id === 'showcase:c-case-bds');
    expect(showcase?.htmlUrl).toBe('https://tqd.me/xray/c-case-bds');
    expect(showcase?.markdownUrl).toBe('https://tqd.me/xray/c-case-bds.md');
  });
});

describe('/catalog.json route', () => {
  it('queries curated c-* shares from D1 and responds with JSON + read-only CORS headers', async () => {
    vi.resetModules();
    const prepare = vi.fn().mockReturnValue({
      all: vi.fn().mockResolvedValue({
        results: [
          {
            share_id: 'c-demo-01',
            title: 'Case Demo 01',
            platform_label: 'TikTok',
            format_key: 'tiktok-script',
            industry: 'Giáo dục',
            viet_pro_score: 96,
            created_at: 1760000000,
          },
        ],
      }),
    });

    vi.doMock('cloudflare:workers', () => ({ env: { DB: { prepare } } }));
    vi.doMock('./content', async () => {
      const actual = await vi.importActual<typeof import('./content')>('./content');
      return {
        ...actual,
        loadSiteData: vi.fn().mockResolvedValue(sampleSiteData),
        getVersion: vi.fn().mockResolvedValue(7),
      };
    });

    const route = await import('../pages/catalog.json');
    const res = await route.GET({ request: new Request('https://tqd.me/catalog.json') } as never);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining("share_id LIKE 'c-%'"));

    const body = JSON.parse(await res.text());
    expect(body.schemaVersion).toBe('1.0');
    expect(body.contentVersion).toBe(7);
    expect(body.items.some((i: { id: string }) => i.id === 'showcase:c-demo-01')).toBe(true);

    const opt = await route.OPTIONS({ request: new Request('https://tqd.me/catalog.json', { method: 'OPTIONS' }) } as never);
    expect(opt.status).toBe(204);
    expect(opt.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});
