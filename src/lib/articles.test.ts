import { describe, expect, it } from 'vitest';
import { type ArticleInput, slugify, validateArticle } from './articles';

describe('slugify', () => {
  it('strips Vietnamese marks and punctuation', () => {
    expect(slugify('Trợ lý AI: Đánh giá 2026!')).toBe('tro-ly-ai-danh-gia-2026');
  });

  it('caps the length at 80 without a trailing dash', () => {
    const slug = slugify('a '.repeat(100));
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('validateArticle', () => {
  const ok: ArticleInput = { slug: 'bai-mot', title: 'Bài một', summary: '', bodyMd: 'Nội dung', tags: ['ai'], status: 'draft' };

  it('accepts a valid article', () => {
    expect(validateArticle(ok)).toEqual([]);
  });

  it('reports each problem', () => {
    const errors = validateArticle({
      ...ok,
      slug: 'Bài Một',
      title: '',
      summary: 'x'.repeat(501),
      bodyMd: '',
      tags: Array.from({ length: 11 }, () => 't'),
      status: 'gone' as never,
    });
    expect(errors).toHaveLength(6);
  });
});
