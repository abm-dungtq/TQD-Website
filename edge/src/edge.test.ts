import { describe, expect, it } from 'vitest';
import { buildAgentCard, buildCatalog, buildRssXml, buildSitemap, escapeXml } from './discovery';
import { htmlToMarkdown, htmlToText } from './html-to-md';
import { deriveSummary, extractLinks, extractTikTokId, toReaderItem } from './posts';
import { llmsText, SITE, toIsoUtc, type ReaderData } from './site';

const ORIGIN = 'https://tqd.me';

const article = {
  id: 7,
  slug: 'ai-agent-cho-doanh-nghiep',
  title: 'AI Agent cho doanh nghiệp & quy trình',
  summary: 'Tóm tắt <b>thực chiến</b>',
  bodyMd: 'Nội dung **chính**.',
  tags: ['AI Agent', 'Vận hành'],
  publishedAt: '2026-10-12T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

const data: ReaderData = {
  site: SITE,
  products: [
    {
      id: 1,
      title: 'Hệ thống AI Agent',
      summary: 'Tự động hoá vận hành.',
      tags: ['AI'],
      links: [{ label: 'Xem', href: '/san-pham' }],
    },
  ],
  videos: [],
  gallery: [{ caption: 'Lớp Agribank', href: '/media/2026/10/agribank.webp' }],
  articles: [article],
};

describe('htmlToMarkdown', () => {
  it('converts headings, links, images and emphasis and strips scripts', () => {
    const html =
      '<script>alert(1)</script><h2>Xin chào</h2><p>Đọc <a href="/bai-viet/a">bài viết</a> và <strong>ghi nhớ</strong>.</p><img src="/media/a.webp" alt="Ảnh &amp; chữ">';
    const md = htmlToMarkdown(html);
    expect(md).not.toContain('alert(1)');
    expect(md).toContain('## Xin chào');
    expect(md).toContain('[bài viết](/bai-viet/a)');
    expect(md).toContain('**ghi nhớ**');
    expect(md).toContain('![Ảnh & chữ](/media/a.webp)');
  });

  it('renders simple tables and keeps pipes escaped', () => {
    const md = htmlToMarkdown('<table><tr><th>A</th><th>B</th></tr><tr><td>1|2</td><td>3</td></tr></table>');
    expect(md).toContain('| A | B |');
    expect(md).toContain('| --- | --- |');
    expect(md).toContain('1\\|2');
  });

  it('returns plain text for summaries', () => {
    expect(htmlToText('<p>Xin&nbsp;<b>chào</b></p>')).toBe('Xin chào');
  });
});

describe('origin post helpers', () => {
  it('extracts absolute links, first media and TikTok ids', () => {
    const html = '<a href="/shop">Cửa hàng</a><a href="javascript:alert(1)">x</a><img src="/media/a.webp"><iframe src="https://www.tiktok.com/player/v1/741234567890"></iframe>';
    expect(extractLinks(html, ORIGIN)).toEqual([{ label: 'Cửa hàng', href: `${ORIGIN}/shop` }]);
    expect(extractTikTokId(html)).toBe('741234567890');
  });

  it('builds a reader item and derives a summary when the API has none', () => {
    const item = toReaderItem(
      {
        id: 3,
        slug: 'p',
        title: 'Sản phẩm AI',
        publishedAt: '2026-10-12 08:30:00',
        terms: [{ name: 'AI' }, { slug: 'tool' }],
        content: '<p>Sản phẩm <a href="/shop">mua ngay</a></p>',
      },
      ORIGIN,
    );
    expect(item.date).toBe('12/10/2026');
    expect(item.tags).toEqual(['AI', 'tool']);
    expect(item.summary).toBe('Sản phẩm mua ngay');
    expect(item.links[0].href).toBe(`${ORIGIN}/shop`);
    expect(deriveSummary('<p>Tiêu đề</p><p>Thân bài dài</p>', 'Tiêu đề')).toBe('Thân bài dài');
  });
});

describe('discovery builders', () => {
  it('normalises epoch seconds and milliseconds', () => {
    expect(toIsoUtc(1_700_000_000)).toBe('2023-11-14T22:13:20.000Z');
    expect(toIsoUtc(1_700_000_000_000)).toBe('2023-11-14T22:13:20.000Z');
  });

  it('writes RSS with escaped metadata and article links', () => {
    const xml = buildRssXml(data, ORIGIN);
    expect(xml).toContain(`<link>${ORIGIN}/bai-viet/ai-agent-cho-doanh-nghiep</link>`);
    expect(xml).toContain('AI Agent cho doanh nghiệp &amp; quy trình');
    expect(xml).toContain(`${ORIGIN}/bai-viet/ai-agent-cho-doanh-nghiep.md`);
    expect(escapeXml('<&>')).toBe('&lt;&amp;&gt;');
  });

  it('lists every public page in the sitemap', () => {
    const xml = buildSitemap(data, ORIGIN);
    for (const path of ['/', '/shop', '/tai-video', '/quyen-rieng-tu', '/ho-so', '/bai-viet/ai-agent-cho-doanh-nghiep']) {
      expect(xml).toContain(`<loc>${ORIGIN}${path}</loc>`);
    }
  });

  it('exposes catalog, agent card and llms links', () => {
    const catalog = buildCatalog(data, ORIGIN, '2026-11-21T00:00:00.000Z');
    expect(catalog.schemaVersion).toBe('1.0');
    expect(JSON.stringify(catalog)).toContain('/shop.md');

    const card = buildAgentCard(data, ORIGIN);
    const cardText = JSON.stringify(card);
    expect(cardText).toContain('/llms-full.txt');
    expect(cardText).toContain('/tai-video.md');

    const llms = llmsText(data, ORIGIN);
    expect(llms).toContain('/.well-known/agent.json');
    expect(llms).toContain('/bai-viet/ai-agent-cho-doanh-nghiep.md');
  });
});
