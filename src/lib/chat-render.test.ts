import { describe, expect, it } from 'vitest';
import { isSiteUrl, parseInline, parseReply } from './chat-render';

describe('isSiteUrl', () => {
  it.each(['https://tqd.io.vn', 'https://tqd.io.vn/', 'https://tqd.io.vn/bai-viet/agent', 'https://tqd.io.vn/#lien-he'])('accepts %s', (url) => {
    expect(isSiteUrl(url)).toBe(true);
  });

  it.each([
    'http://tqd.io.vn/',
    'https://tqd.io.vn.evil.example/',
    'https://evil.example/https://tqd.io.vn',
    'https://tqd.io.vn@evil.example/',
    'javascript:alert(1)',
  ])('rejects %s', (url) => {
    expect(isSiteUrl(url)).toBe(false);
  });
});

describe('parseInline', () => {
  it('links site URLs and leaves trailing punctuation as text', () => {
    expect(parseInline('Xem https://tqd.io.vn/san-pham.')).toEqual([
      { kind: 'text', text: 'Xem ' },
      { kind: 'link', text: 'https://tqd.io.vn/san-pham', href: 'https://tqd.io.vn/san-pham' },
      { kind: 'text', text: '.' },
    ]);
  });

  it('keeps other URLs as plain text', () => {
    expect(parseInline('Mã nguồn: https://github.com/abm-dungtq/viet-pro-codex')).toEqual([
      { kind: 'text', text: 'Mã nguồn: https://github.com/abm-dungtq/viet-pro-codex' },
    ]);
  });

  it('shows the real target of a markdown link that leaves the site', () => {
    expect(parseInline('[Trang DũngTQ](https://evil.example/login)')).toEqual([
      { kind: 'text', text: 'Trang DũngTQ (https://evil.example/login)' },
    ]);
  });

  it('turns markdown site links and bold into parts', () => {
    expect(parseInline('**Viết Pro**: [chi tiết](https://tqd.io.vn/san-pham)')).toEqual([
      { kind: 'bold', text: 'Viết Pro' },
      { kind: 'text', text: ': ' },
      { kind: 'link', text: 'chi tiết', href: 'https://tqd.io.vn/san-pham' },
    ]);
  });

  it('keeps markup-looking text as text', () => {
    expect(parseInline('<img src=x onerror=alert(1)>')).toEqual([{ kind: 'text', text: '<img src=x onerror=alert(1)>' }]);
  });
});

describe('parseReply', () => {
  it('splits paragraphs, bullet and numbered lists', () => {
    const blocks = parseReply('Mở đầu\ndòng hai\n\n- một\n- hai\n1. ba\n2. bốn\nKết');
    expect(blocks.map((b) => b.kind)).toEqual(['p', 'ul', 'ol', 'p']);
    expect(blocks[0]).toEqual({ kind: 'p', lines: [[{ kind: 'text', text: 'Mở đầu' }], [{ kind: 'text', text: 'dòng hai' }]] });
    expect(blocks[1]).toEqual({ kind: 'ul', items: [[{ kind: 'text', text: 'một' }], [{ kind: 'text', text: 'hai' }]] });
  });

  it('renders headings as bold lines', () => {
    expect(parseReply('## Tóm tắt')).toEqual([{ kind: 'p', lines: [[{ kind: 'bold', text: 'Tóm tắt' }]] }]);
  });

  it('returns nothing for blank text', () => {
    expect(parseReply(' \n\n ')).toEqual([]);
  });
});
