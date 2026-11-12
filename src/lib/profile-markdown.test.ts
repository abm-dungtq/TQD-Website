import { describe, expect, it } from 'vitest';
import type { Article, Item, SiteData } from './content';
import { llmsFullText, llmsText, sectionMarkdown } from './profile-markdown';
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

describe('sectionMarkdown & llms surfaces', () => {
  it('starts standalone section markdown with H1 and canonical metadata', () => {
    const md = sectionMarkdown('san-pham', data, 'https://tqd.me', '2026-11-12');
    expect(md).toMatch(/^# Sản phẩm · DũngTQ/);
    expect(md).toContain('Nguồn: https://tqd.me/san-pham');
    expect(md).toContain('Cập nhật: 2026-11-12');
    expect(md).toContain('[Bài giới thiệu](https://tqd.me/bai-viet/viet-pro)');
    expect(md).toContain('[GitHub](https://github.com/abm-dungtq/viet-pro-codex)');
  });

  it('lists articles by their markdown twins', () => {
    expect(sectionMarkdown('bai-viet', data)).toContain('(https://tqd.me/bai-viet/viet-pro.md): Tóm tắt');
  });

  it('includes article summaries, privacy policy, and llms-full.txt in llms.txt', () => {
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

    const indexTxt = llmsText(withPerson);
    expect(indexTxt).toContain('- [Viết Pro](https://tqd.me/bai-viet/viet-pro.md): Tóm tắt');
    expect(indexTxt).toContain('https://tqd.me/quyen-rieng-tu.md');
    expect(indexTxt).toContain('https://tqd.me/llms-full.txt');
    expect(indexTxt).toContain('https://zalo.me/trinhquangdung');

    const fullTxt = llmsFullText(withPerson, 'https://tqd.me', '2026-11-12');
    expect(fullTxt).toContain('# Kho Tri Thức Đầy Đủ — Trịnh Quang Dũng (DũngTQ)');
    expect(fullTxt).toContain('Nội dung bài viết thực tế.');
    expect(fullTxt).toContain('Chính sách Quyền riêng tư');
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
