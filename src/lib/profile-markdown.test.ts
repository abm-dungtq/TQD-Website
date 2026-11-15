import { describe, expect, it } from 'vitest';
import {
  clampMetaDescription,
  listRecentArticlesWithBody,
  SECTION_SEO,
  toIsoUtc,
  type Article,
  type Item,
  type SectionId,
  type Site,
  type SiteData,
} from './content';
import {
  articleMarkdown,
  llmsFullText,
  llmsText,
  privacyMarkdown,
  profileMarkdown,
  renderFrontmatter,
  sectionMarkdown,
  taiVideoMarkdown,
} from './profile-markdown';
import { estimateReadingMinutes, injectHeadingIdsAndToc, slugifyVietnamese } from './toc';

const item: Item = {
  id: 1,
  kind: 'product',
  title: 'Viết Pro',
  summary: 's',
  tags: ['Skill'],
  links: [
    { label: 'GitHub', href: 'https://github.com/abm-dungtq/viet-pro-codex' },
    { label: 'Bài giới thiệu', href: '/bai-viet/viet-pro' },
  ],
  sort: 10,
  visible: true,
};

const data = {
  site: {
    sections: [
      { id: 'san-pham', title: 'Sản phẩm', short: 'Hệ công cụ AI thực chiến', icon: 'box' },
      { id: 'bai-viet', title: 'Bài viết', short: 'Ghi chép kỹ thuật', icon: 'book' },
    ],
    topics: { howTo: [], marketWatch: [] },
  },
  products: [item],
  videos: [],
  articles: [
    {
      slug: 'viet-pro',
      title: 'Viết Pro',
      summary: 'Tóm tắt',
      bodyMd: '## Mở đầu\n\nNội dung bài viết thực tế.',
      bodyHtml: '<h2>Mở đầu</h2><p>Nội dung bài viết thực tế.</p>',
      tags: ['AI', 'Viết lách'],
      publishedAt: '2026-10-01 08:00:00',
      updatedAt: '2026-10-02 09:00:00',
    } as Article,
  ],
} as unknown as SiteData;

describe('sectionMarkdown, frontmatter & llms surfaces', () => {
  const withPerson = {
    ...data,
    site: {
      ...data.site,
      person: {
        name: 'Trịnh Quang Dũng',
        handle: 'DũngTQ',
        role: 'ABM',
        intro: 'Giới thiệu',
        email: 'dungtq.ceo@gmail.com',
        focus: ['Agent'],
      },
      links: [],
      gallery: [],
    },
  } as unknown as SiteData;

  it('escapes YAML special chars safely in renderFrontmatter', () => {
    const fm = renderFrontmatter({
      source: 'https://tqd.me/xray/c-abc123',
      title: 'Phân tích: "Hook 3 giây"\n#viral',
      author: 'Trịnh Quang Dũng (DũngTQ)',
      updated: '2026-11-12 08:30:00',
      summary: 'Tóm tắt: có dấu : và "ngoặc kép"',
      tags: ['AI', 'Viết Pro: v2'],
      curated: true,
      robots: 'index, follow',
    });
    expect(fm).toMatch(/^---\n/);
    expect(fm).toMatch(/\n---$/);
    expect(fm).toContain('title: "Phân tích: \\"Hook 3 giây\\"\\n#viral"');
    expect(fm).toContain('updated: "2026-11-12T08:30:00.000Z"');
    expect(fm).toContain('curated: true');
    expect(fm).toContain('robots: "index, follow"');
    expect(fm).toContain('tags: ["AI", "Viết Pro: v2"]');
  });

  it('prepends YAML frontmatter, removes duplicate > Nguồn lines, and adds /tai-video to san-pham.md', () => {
    const md = sectionMarkdown('san-pham', data, 'https://tqd.me', '2026-11-12');
    expect(md).not.toBeNull();
    expect(md!).toMatch(/^---\n/);
    expect(md!).toContain('source: "https://tqd.me/san-pham"');
    expect(md!).toContain('updated: "2026-11-12T00:00:00.000Z"');
    expect(md!).toContain('\n# Sản phẩm · DũngTQ\n');
    expect(md!).not.toContain('> Nguồn:');
    expect(md!).toContain('[Bài giới thiệu](https://tqd.me/bai-viet/viet-pro)');
    expect(md!).toContain('[GitHub](https://github.com/abm-dungtq/viet-pro-codex)');
    expect(md!).toContain('Tải Video & Mổ Xẻ Kịch Bản Viral AI');
    expect(md!).toContain('https://tqd.me/tai-video');
    expect(md!).toContain('https://tqd.me/tai-video.md');

    const profileMd = profileMarkdown(withPerson, 'https://tqd.me', '2026-11-12 10:00:00');
    expect(profileMd).toMatch(/^---\nsource: "https:\/\/tqd\.me\/"/);
    expect(profileMd).toContain('updated: "2026-11-12T10:00:00.000Z"');
    expect(profileMd).not.toContain('> Nguồn:');

    const artMd = articleMarkdown(data.articles[0], withPerson.site as Site, 'https://tqd.me');
    expect(artMd).toMatch(/^---\nsource: "https:\/\/tqd\.me\/bai-viet\/viet-pro"/);
    expect(artMd).toContain('updated: "2026-10-02T09:00:00.000Z"');
    expect(artMd).not.toContain('> Nguồn:');

    const taiVideoMd = taiVideoMarkdown('https://tqd.me', '2026-11-12');
    expect(taiVideoMd).toMatch(/^---\nsource: "https:\/\/tqd\.me\/tai-video"/);
    expect(taiVideoMd).not.toContain('> Nguồn:');

    const privMd = privacyMarkdown('https://tqd.me', 'dungtq.ceo@gmail.com', '2026-11-12');
    expect(privMd).toMatch(/^---\nsource: "https:\/\/tqd\.me\/quyen-rieng-tu"/);
    expect(privMd).not.toContain('> Nguồn:');
  });

  it('lists articles by their markdown twins', () => {
    expect(sectionMarkdown('bai-viet', data)).toContain('(https://tqd.me/bai-viet/viet-pro.md): Tóm tắt');
  });

  it('includes featured tools and Machine Discovery links in llms.txt', () => {
    const indexTxt = llmsText(withPerson, 'https://tqd.me');
    expect(indexTxt).toContain('## Sản phẩm & Công cụ AI nổi bật');
    expect(indexTxt).toContain('https://tqd.me/tai-video');
    expect(indexTxt).toContain('- [Viết Pro](https://tqd.me/bai-viet/viet-pro.md): Tóm tắt');
    expect(indexTxt).toContain('https://tqd.me/quyen-rieng-tu.md');
    expect(indexTxt).toContain('## Danh mục máy đọc (Machine Discovery)');
    expect(indexTxt).toContain('https://tqd.me/.well-known/agent.json');
    expect(indexTxt).toContain('https://tqd.me/catalog.json');
    expect(indexTxt).toContain('https://tqd.me/rss.xml');
    expect(indexTxt).toContain('https://tqd.me/feed.json');
    expect(indexTxt).toContain('https://tqd.me/sitemap.xml');
    expect(indexTxt).toContain('https://tqd.me/llms-full.txt');
    expect(indexTxt).toContain('https://zalo.me/trinhquangdung');
  });

  it('builds llmsFullText with TOC, full bodyMd, and caps total size at 120_000 chars', () => {
    const legacyTxt = llmsFullText(withPerson, 'https://tqd.me', '2026-11-12');
    expect(legacyTxt).toContain('# Kho Tri Thức Đầy Đủ — Trịnh Quang Dũng (DũngTQ)');
    expect(legacyTxt).toContain('## Mục lục');
    expect(legacyTxt).toContain('Nội dung bài viết thực tế.');
    expect(legacyTxt).toContain('Chính sách Quyền riêng tư');

    const metadataOnlyData = {
      ...withPerson,
      articles: Array.from({ length: 14 }, (_, idx) => ({
        id: idx + 1,
        slug: `bai-${idx + 1}`,
        title: `Bài viết số ${idx + 1}`,
        summary: `Tóm tắt bài ${idx + 1}`,
        bodyMd: '',
        bodyHtml: '',
        tags: ['AI'],
        status: 'published',
        source: 'web',
        fbOverlap: false,
        version: 1,
        publishedAt: `2026-11-${String(14 - idx).padStart(2, '0')} 08:00:00`,
        updatedAt: `2026-11-${String(14 - idx).padStart(2, '0')} 09:00:00`,
      })) as Article[],
    } as unknown as SiteData;

    const recentWithBody = metadataOnlyData.articles.slice(0, 12).map((a, idx) => ({
      ...a,
      bodyMd: `Nội dung chi tiết bài ${idx + 1}: ` + 'Chống văn mẫu AI hiệu quả. '.repeat(600),
    }));

    const cappedTxt = llmsFullText(metadataOnlyData, 'https://tqd.me', recentWithBody, '2026-11-15 10:00:00');
    expect(cappedTxt.length).toBeLessThanOrEqual(120_000);
    expect(cappedTxt).toContain('Nội dung chi tiết bài 1:');
    // Older / overflow items fall back to summary + .md link
    expect(cappedTxt).toContain('- [Bài viết số 14](https://tqd.me/bai-viet/bai-14.md): Tóm tắt bài 14');
    expect(cappedTxt).not.toContain('Nội dung chi tiết bài 12:');
    expect(cappedTxt).toContain('## Bài viết khác (Tóm tắt & liên kết Markdown)');
  });
});

describe('content helpers & SEO metadata', () => {
  it('normalizes SQLite and date strings via toIsoUtc and clamps descriptions on word boundaries', () => {
    expect(toIsoUtc('2026-11-12 08:30:00')).toBe('2026-11-12T08:30:00.000Z');
    expect(toIsoUtc('2026-11-12')).toBe('2026-11-12T00:00:00.000Z');
    expect(toIsoUtc('2026-11-12T08:30:00+07:00')).toBe('2026-11-12T01:30:00.000Z');

    const clamped = clampMetaDescription('Một hai ba bốn năm sáu bảy tám chín mười mười một mười hai', 25);
    expect(clamped.length).toBeLessThanOrEqual(25);
    expect(clamped.endsWith('…')).toBe(true);
    expect(clamped).toBe('Một hai ba bốn năm sáu…');
  });

  it('defines compliant SECTION_SEO titles/descriptions without legacy product names', () => {
    const sections: SectionId[] = ['ho-so', 'san-pham', 'thu-vien', 'video-ai', 'bai-viet', 'lien-he'];
    const legacyPhrase = ['opus', 'video'].join(' ');
    const legacySlug = ['opus', 'video'].join('-');
    for (const id of sections) {
      const seo = SECTION_SEO[id];
      expect(seo.title.length).toBeGreaterThanOrEqual(45);
      expect(seo.title.length).toBeLessThanOrEqual(60);
      expect(seo.description.length).toBeGreaterThanOrEqual(130);
      expect(seo.description.length).toBeLessThanOrEqual(155);
      const lower = `${seo.title} ${seo.description}`.toLowerCase();
      expect(lower).not.toContain(legacyPhrase);
      expect(lower).not.toContain(legacySlug);
    }
  });

  it('queries published articles with full body in listRecentArticlesWithBody', async () => {
    let capturedSql = '';
    let capturedLimit: unknown;
    const mockDb = {
      prepare(sql: string) {
        capturedSql = sql;
        return {
          bind(limit: unknown) {
            capturedLimit = limit;
            return {
              async all() {
                return {
                  results: [
                    {
                      id: 1,
                      slug: 'demo',
                      title: 'Demo',
                      summary: 'S',
                      body_md: 'Full body',
                      body_html: '<p>Full body</p>',
                      cover_key: null,
                      tags: '["AI"]',
                      status: 'published',
                      source: 'web',
                      fb_overlap: 0,
                      version: 1,
                      published_at: '2026-11-12 08:00:00',
                      updated_at: '2026-11-12 09:00:00',
                    },
                  ],
                };
              },
            };
          },
        };
      },
    } as unknown as D1Database;

    const list = await listRecentArticlesWithBody(mockDb, 12);
    expect(capturedSql).toContain('body_md, body_html');
    expect(capturedSql).toContain("WHERE status = 'published'");
    expect(capturedSql).toContain('ORDER BY published_at DESC, id DESC LIMIT ?1');
    expect(capturedLimit).toBe(12);
    expect(list[0].bodyMd).toBe('Full body');
  });
});

describe('toc & Vietnamese heading anchors', () => {
  it('slugifies Vietnamese diacritics and deduplicates repeated headings', () => {
    expect(slugifyVietnamese('Đổi Ngành Giữ Khung & Chống Văn Mẫu AI')).toBe(
      'doi-nganh-giu-khung-chong-van-mau-ai',
    );
    const { html, headings } = injectHeadingIdsAndToc(
      '<h2>Đổi Ngành</h2><p>A</p><h3>Chi tiết</h3><h2>Đổi Ngành</h2>',
    );
    expect(headings).toEqual([
      { id: 'doi-nganh', text: 'Đổi Ngành', level: 2 },
      { id: 'chi-tiet', text: 'Chi tiết', level: 3 },
      { id: 'doi-nganh-2', text: 'Đổi Ngành', level: 2 },
    ]);
    expect(html).toContain('<h2 id="doi-nganh">Đổi Ngành</h2>');
    expect(html).toContain('<h2 id="doi-nganh-2">Đổi Ngành</h2>');
    expect(estimateReadingMinutes('<p>Một hai ba bốn năm</p>')).toBe(1);
  });
});
