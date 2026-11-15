import { describe, expect, it } from 'vitest';
import type { Article, Site } from './content';
import {
  articleNode,
  breadcrumbNode,
  collectionPageNode,
  contactPageNode,
  personNode,
  profilePageNode,
  toIsoUtc,
  webAppNode,
  xrayArticleNode,
} from './structured-data';

const siteFixture: Site = {
  person: {
    name: 'Trịnh Quang Dũng',
    handle: 'DũngTQ',
    initials: 'TD',
    role: 'Đào tạo & Triển khai AI Doanh nghiệp tại ABM',
    intro: 'Đào tạo AI nội bộ.\n\nThiết kế AI Agent và Skill thực chiến.',
    portrait: '/media/portrait.webp',
    portraitSmall: '/media/portrait-sm.webp',
    portraitAlt: 'Trịnh Quang Dũng',
    email: 'dungtq.ceo@gmail.com',
    zalo: 'https://zalo.me/trinhquangdung',
    focus: ['AI Agent', 'Skill Viết Pro'],
  },
  sections: [
    { id: 'ho-so', title: 'Hồ sơ', short: 'Hồ sơ', icon: 'user' },
    { id: 'san-pham', title: 'Sản phẩm', short: 'Sản phẩm', icon: 'box' },
    { id: 'thu-vien', title: 'Thư viện', short: 'Thư viện', icon: 'image' },
    { id: 'video-ai', title: 'Video AI', short: 'Video AI', icon: 'film' },
    { id: 'bai-viet', title: 'Bài viết', short: 'Bài viết', icon: 'book' },
    { id: 'lien-he', title: 'Liên hệ', short: 'Liên hệ', icon: 'mail' },
  ],
  topics: { howTo: [], marketWatch: [] },
  gallery: [],
  links: [
    { label: 'Zalo', href: 'https://zalo.me/trinhquangdung' },
    { label: 'GitHub', href: 'https://github.com/abm-dungtq' },
    { label: 'Email', href: 'mailto:dungtq.ceo@gmail.com' },
  ],
};

function collectJsonLdReferences(
  node: unknown,
  definedIds: Set<string>,
  refs: Set<string>,
  isTopGraphNode = false,
): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) collectJsonLdReferences(item, definedIds, refs, false);
    return;
  }
  const obj = node as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (typeof obj['@id'] === 'string') {
    if (isTopGraphNode || keys.length > 1) {
      definedIds.add(obj['@id']);
    } else {
      refs.add(obj['@id']);
    }
  }
  for (const [k, v] of Object.entries(obj)) {
    if (k === '@id') continue;
    collectJsonLdReferences(v, definedIds, refs, false);
  }
}

function assertValidGraph(canonicalUrl: string, nodes: Record<string, unknown>[], origin = 'https://tqd.me') {
  const baseOrigin = origin.endsWith('/') ? origin : `${origin}/`;
  const graph = [
    { '@type': 'WebSite', '@id': `${baseOrigin}#website`, url: baseOrigin, name: 'DũngTQ', inLanguage: 'vi' },
    {
      '@type': 'WebPage',
      '@id': `${canonicalUrl}#webpage`,
      url: canonicalUrl,
      name: 'Test',
      isPartOf: { '@id': `${baseOrigin}#website` },
    },
    ...nodes,
  ];
  const serialized = JSON.stringify(graph);
  expect(serialized).not.toContain('"FAQPage"');
  expect(serialized).not.toContain('"HowTo"');

  const definedIds = new Set<string>();
  const refs = new Set<string>();
  for (const node of graph) {
    collectJsonLdReferences(node, definedIds, refs, true);
  }
  const dangling = [...refs].filter((ref) => !definedIds.has(ref));
  expect(dangling).toEqual([]);
}

describe('structured-data JSON-LD builders', () => {
  it('adds ABM worksFor organization to personNode and keeps ProfilePage graph valid', () => {
    const origin = 'https://tqd.me';
    const url = 'https://tqd.me/ho-so';
    const person = personNode(siteFixture, origin);
    expect(person.worksFor).toEqual({
      '@type': 'Organization',
      name: 'Công ty Cổ phần Công nghệ và Đào tạo ABM',
      url: 'https://lp.abmedu.vn',
    });

    assertValidGraph(url, [
      person,
      profilePageNode(url),
      breadcrumbNode(
        [
          { name: 'Trang chủ', url: 'https://tqd.me/' },
          { name: 'Hồ sơ', url },
        ],
        url,
      ),
    ]);
  });

  it('builds CollectionPage + ItemList for collection sections without dangling @ids', () => {
    const url = 'https://tqd.me/san-pham';
    const node = collectionPageNode({
      url,
      origin: 'https://tqd.me',
      name: 'Sản phẩm',
      description: 'Danh sách công cụ và Skill AI',
      items: [
        { name: 'Viết Pro', url: 'https://tqd.me/bai-viet/viet-pro', description: 'Skill chống văn mẫu' },
        { name: 'Tải Video Viral AI', url: 'https://tqd.me/tai-video', description: 'Mổ xẻ kịch bản' },
      ],
    });

    expect(node['@type']).toBe('CollectionPage');
    expect(node.mainEntity['@type']).toBe('ItemList');
    expect(node.mainEntity.numberOfItems).toBe(2);
    assertValidGraph(url, [
      personNode(siteFixture, 'https://tqd.me'),
      node,
      breadcrumbNode(
        [
          { name: 'Trang chủ', url: 'https://tqd.me/' },
          { name: 'Sản phẩm', url },
        ],
        url,
      ),
    ]);
  });

  it('builds ContactPage for lien-he and TechArticle for curated xray reports', () => {
    const contactUrl = 'https://tqd.me/lien-he';
    const contact = contactPageNode(siteFixture, contactUrl, 'https://tqd.me');
    expect(contact['@type']).toBe('ContactPage');
    expect(contact.contactPoint.url).toBe('https://zalo.me/trinhquangdung');
    assertValidGraph(contactUrl, [
      personNode(siteFixture, 'https://tqd.me'),
      contact,
      breadcrumbNode(
        [
          { name: 'Trang chủ', url: 'https://tqd.me/' },
          { name: 'Liên hệ', url: contactUrl },
        ],
        contactUrl,
      ),
    ]);

    const xrayUrl = 'https://tqd.me/xray/c-abcdef1234567890';
    const xray = xrayArticleNode({
      url: xrayUrl,
      origin: 'https://tqd.me',
      headline: 'Mổ xẻ Viral: Demo Hook 3 giây',
      description: 'Phân tích công thức giữ chân',
      createdAt: 1762905600,
      keywords: ['TikTok', 'Viết Pro'],
    });
    expect(xray['@type']).toBe('TechArticle');
    expect(xray.datePublished).toBe(new Date(1762905600 * 1000).toISOString());
    assertValidGraph(xrayUrl, [
      personNode(siteFixture, 'https://tqd.me'),
      xray,
      breadcrumbNode(
        [
          { name: 'Trang chủ', url: 'https://tqd.me/' },
          { name: 'Xưởng Mổ Xẻ Video', url: 'https://tqd.me/tai-video' },
          { name: 'Demo', url: xrayUrl },
        ],
        xrayUrl,
      ),
    ]);
  });

  it('builds WebApplication with operatingSystem Web, isAccessibleForFree true, featureList, and valid Article dates', () => {
    const appUrl = 'https://tqd.me/tai-video';
    const app = webAppNode(appUrl, 'https://tqd.me');
    expect(app.operatingSystem).toBe('Web');
    expect(app.isAccessibleForFree).toBe(true);
    expect(app.featureList.length).toBeGreaterThanOrEqual(3);
    assertValidGraph(appUrl, [personNode(siteFixture, 'https://tqd.me'), app]);

    const article: Article = {
      id: 1,
      slug: 'demo-agent',
      title: 'Demo Agent',
      summary: 'Tóm tắt',
      bodyMd: 'Nội dung',
      bodyHtml: '<p>Nội dung</p>',
      tags: ['AI', 'Agent'],
      status: 'published',
      source: 'web',
      fbOverlap: false,
      version: 1,
      publishedAt: '2026-11-12 08:30:00',
      updatedAt: '2026-11-12 09:45:00',
    };
    const artUrl = 'https://tqd.me/bai-viet/demo-agent';
    const art = articleNode(article, artUrl);
    expect(art.datePublished).toBe(toIsoUtc('2026-11-12 08:30:00'));
    expect(art.dateModified).toBe('2026-11-12T09:45:00.000Z');
    assertValidGraph(artUrl, [personNode(siteFixture, 'https://tqd.me'), art]);
  });
});
