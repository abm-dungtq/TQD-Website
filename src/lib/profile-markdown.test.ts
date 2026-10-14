import { describe, expect, it } from 'vitest';
import type { Article, Item, SiteData } from './content';
import { sectionMarkdown } from './profile-markdown';

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
      { id: 'san-pham', title: 'Sản phẩm', short: '', icon: 'box' },
      { id: 'bai-viet', title: 'Bài viết', short: '', icon: 'book' },
    ],
    topics: { howTo: [], marketWatch: [] },
  },
  products: [item],
  articles: [{ slug: 'viet-pro', title: 'Viết Pro', summary: 'Tóm tắt' } as Article],
} as unknown as SiteData;

describe('sectionMarkdown', () => {
  it('makes links to the site absolute and keeps external links', () => {
    const md = sectionMarkdown('san-pham', data);
    expect(md).toContain('[Bài giới thiệu](https://tqd.io.vn/bai-viet/viet-pro)');
    expect(md).toContain('[GitHub](https://github.com/abm-dungtq/viet-pro-codex)');
  });

  it('lists articles by their markdown twins', () => {
    expect(sectionMarkdown('bai-viet', data)).toContain('(https://tqd.io.vn/bai-viet/viet-pro.md): Tóm tắt');
  });
});
