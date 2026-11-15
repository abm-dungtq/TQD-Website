import { describe, expect, it, vi } from 'vitest';
import { buildAgentCard } from './agent-card';
import {
  DEFAULT_DAILY_CAP,
  IP_PER_HOUR,
  MAX_MESSAGE_CHARS,
  VISITOR_PER_HOUR,
} from './chat';
import type { SiteData } from './content';
import {
  DEFAULT_DL_DAILY_CAP,
  PUBLIC_IP_PER_HOUR,
  PUBLIC_RESOLVE_IP_PER_HOUR,
  PUBLIC_RESOLVE_VISITOR_PER_HOUR,
  PUBLIC_VISITOR_PER_HOUR,
  TIER_LIMITS,
} from './dl';
import {
  DEFAULT_VIRAL_DAILY_CAP,
  PUBLIC_GENERATE_IP_PER_HOUR,
  PUBLIC_GENERATE_VISITOR_PER_HOUR,
  PUBLIC_MAX_VIDEO_SEC,
  PUBLIC_SHARE_IP_PER_HOUR,
  PUBLIC_SHARE_VISITOR_PER_HOUR,
  PUBLIC_TRANSCRIBE_IP_PER_HOUR,
  PUBLIC_TRANSCRIBE_VISITOR_PER_HOUR,
} from './viral';

const sampleSiteData: SiteData = {
  site: {
    person: {
      name: 'Trịnh Quang Dũng',
      handle: 'DũngTQ',
      initials: 'TD',
      role: 'CEO ABM & Tư vấn AI',
      intro: 'Ứng dụng AI cho doanh nghiệp.',
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
      slug: 'bai-viet-cong-khai',
      title: 'Bài viết công khai',
      summary: 'Tóm tắt',
      bodyMd: 'Nội dung',
      bodyHtml: '<p>Nội dung</p>',
      tags: ['AI'],
      source: 'original',
      fbOverlap: false,
      version: 1,
      publishedAt: '2026-10-01',
      updatedAt: '2026-10-01',
      status: 'published',
    },
    {
      id: 2,
      slug: 'bai-viet-nhap',
      title: 'Bài nháp',
      summary: 'Ẩn',
      bodyMd: 'Ẩn',
      bodyHtml: '<p>Ẩn</p>',
      tags: [],
      source: 'original',
      fbOverlap: false,
      version: 1,
      publishedAt: '2026-10-02',
      updatedAt: '2026-10-02',
      status: 'draft',
    },
  ],
  products: [
    {
      id: 1,
      kind: 'product',
      title: 'ABM Sales Copilot',
      date: '12/10/2026',
      summary: 'Trợ lý kịch bản bán hàng cho đội ngũ B2B.',
      tags: ['Sales', 'ABM'],
      sort: 1,
      visible: true,
    },
    {
      id: 2,
      kind: 'product',
      title: 'Internal Secret Tool',
      date: '12/10/2026',
      summary: 'Không công khai.',
      tags: [],
      sort: 2,
      visible: false,
    },
  ],
  videos: [],
};

describe('buildAgentCard', () => {
  it('builds A2A card reading products from D1 data and real public limits', () => {
    const card = buildAgentCard(sampleSiteData, 'https://tqd.me/');

    expect(card.schemaVersion).toBe('1.0');
    expect(card.provider.name).toBe('Trịnh Quang Dũng (DũngTQ)');
    expect(card.provider.organization).toContain('ABM');
    expect(card.provider.contact.zaloUrl).toBe('https://zalo.me/trinhquangdung');
    expect(card.endpoints.agentCard).toBe('https://tqd.me/.well-known/agent.json');
    expect(card.endpoints.catalogJson).toBe('https://tqd.me/catalog.json');

    expect(card.capabilities.webmcp_browser_tools.webOnlyExecution).toBe(true);
    expect(card.capabilities.webmcp_browser_tools.entryApi).toBe('document.modelContext');
    expect(card.capabilities.sameOriginPublicApis.protected).toBe(true);
    expect(card.capabilities.sameOriginPublicApis.schemes).toContain('same-origin-browser');

    expect(card.knowledgeScope.products).toEqual([
      {
        id: 1,
        title: 'ABM Sales Copilot',
        summary: 'Trợ lý kịch bản bán hàng cho đội ngũ B2B.',
        tags: ['Sales', 'ABM'],
        url: 'https://tqd.me/san-pham',
      },
    ]);
    expect(card.knowledgeScope.publishedArticleCount).toBe(1);

    expect(card.rateLimits.chat).toEqual({
      visitorPerHour: VISITOR_PER_HOUR,
      ipPerHour: IP_PER_HOUR,
      dailySiteCap: DEFAULT_DAILY_CAP,
      maxMessageChars: MAX_MESSAGE_CHARS,
    });
    expect(card.rateLimits.videoDownloader).toEqual({
      resolveVisitorPerHour: PUBLIC_RESOLVE_VISITOR_PER_HOUR,
      resolveIpPerHour: PUBLIC_RESOLVE_IP_PER_HOUR,
      prepareVisitorPerHour: PUBLIC_VISITOR_PER_HOUR,
      prepareIpPerHour: PUBLIC_IP_PER_HOUR,
      dailySiteCap: DEFAULT_DL_DAILY_CAP,
      publicTier: TIER_LIMITS.public,
    });
    expect(card.rateLimits.viralVideoLab).toEqual({
      transcribeVisitorPerHour: PUBLIC_TRANSCRIBE_VISITOR_PER_HOUR,
      transcribeIpPerHour: PUBLIC_TRANSCRIBE_IP_PER_HOUR,
      generateVisitorPerHour: PUBLIC_GENERATE_VISITOR_PER_HOUR,
      generateIpPerHour: PUBLIC_GENERATE_IP_PER_HOUR,
      shareVisitorPerHour: PUBLIC_SHARE_VISITOR_PER_HOUR,
      shareIpPerHour: PUBLIC_SHARE_IP_PER_HOUR,
      dailySiteCap: DEFAULT_VIRAL_DAILY_CAP,
      publicMaxDurationSec: PUBLIC_MAX_VIDEO_SEC,
    });
  });

  it('never leaks internal env vars, loopback URLs, or admin tier limits', () => {
    const serialized = JSON.stringify(buildAgentCard(sampleSiteData, 'https://tqd.me'));

    expect(serialized).not.toContain('CHAT_UPSTREAM_URL');
    expect(serialized).not.toContain('DL_DAEMON_URL');
    expect(serialized).not.toContain('127.0.0.1');
    expect(serialized).not.toContain('localhost');
    expect(serialized).not.toContain('2160');
    expect(serialized).not.toContain('"maxFilesizeMB":2000');
    expect(serialized).not.toContain('"allowCookies":true');
    expect(serialized).not.toContain('"publicMaxDurationSec":1800');
  });
});

describe('/.well-known/agent.json route', () => {
  it('returns application/json, X-Robots-Tag: noindex, and read-only CORS headers', async () => {
    vi.resetModules();
    vi.doMock('cloudflare:workers', () => ({ env: { DB: {} } }));
    vi.doMock('./content', async () => {
      const actual = await vi.importActual<typeof import('./content')>('./content');
      return {
        ...actual,
        loadSiteData: vi.fn().mockResolvedValue(sampleSiteData),
      };
    });

    const route = await import('../pages/.well-known/agent.json');
    const res = await route.GET({ request: new Request('https://tqd.me/.well-known/agent.json') } as never);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');

    const body = JSON.parse(await res.text());
    expect(body.provider.name).toBe('Trịnh Quang Dũng (DũngTQ)');
    expect(body.knowledgeScope.products).toHaveLength(1);

    const opt = await route.OPTIONS({
      request: new Request('https://tqd.me/.well-known/agent.json', { method: 'OPTIONS' }),
    } as never);
    expect(opt.status).toBe(204);
    expect(opt.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});
