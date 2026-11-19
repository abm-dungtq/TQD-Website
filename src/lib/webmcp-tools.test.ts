import { describe, expect, it, vi } from 'vitest';
import {
  fetchSameOriginJson,
  fetchSameOriginText,
  formatProductsOutput,
  formatSearchOutput,
  isAllowedPreset,
  isAllowedSectionId,
  resolveAllowedMarkdownPath,
  sanitizeToolText,
  searchEntries,
  sliceMarkdownContent,
  type SearchEntry,
} from './webmcp-tools';

describe('sanitizeToolText', () => {
  it('strips unsafe control and bidi characters while keeping line breaks', () => {
    const dirty = 'Xin chao\u0000\u0007\u202E\u200B\r\nDungTQ\tABM';
    expect(sanitizeToolText(dirty)).toBe('Xin chao\nDungTQ\tABM');
  });

  it('bounds long output at maxChars (default 1500) with ellipsis', () => {
    const longText = 'a'.repeat(2000);
    const result = sanitizeToolText(longText);
    expect(result.length).toBeLessThanOrEqual(1500);
    expect(result.endsWith('…')).toBe(true);
  });

  it('respects custom small maxChars values', () => {
    expect(sanitizeToolText('abcdefghij', 5)).toBe('abcd…');
    expect(sanitizeToolText('abcde', 5)).toBe('abcde');
    expect(sanitizeToolText('abcdef', 1)).toBe('a');
  });
});

describe('resolveAllowedMarkdownPath', () => {
  it('accepts /index.md and canonical section / utility markdown twins', () => {
    expect(resolveAllowedMarkdownPath('/index.md')).toBe('/index.md');
    expect(resolveAllowedMarkdownPath('/')).toBe('/index.md');
    expect(resolveAllowedMarkdownPath('/ho-so.md')).toBe('/ho-so.md');
    expect(resolveAllowedMarkdownPath('/ho-so')).toBe('/ho-so.md');
    expect(resolveAllowedMarkdownPath('/san-pham.md')).toBe('/san-pham.md');
    expect(resolveAllowedMarkdownPath('/thu-vien.md')).toBe('/thu-vien.md');
    expect(resolveAllowedMarkdownPath('/video-ai.md')).toBe('/video-ai.md');
    expect(resolveAllowedMarkdownPath('/bai-viet.md')).toBe('/bai-viet.md');
    expect(resolveAllowedMarkdownPath('/lien-he.md')).toBe('/lien-he.md');
    expect(resolveAllowedMarkdownPath('/shop.md')).toBe('/shop.md');
    expect(resolveAllowedMarkdownPath('/shop')).toBe('/shop.md');
    expect(resolveAllowedMarkdownPath('/tai-video.md')).toBe('/tai-video.md');
    expect(resolveAllowedMarkdownPath('/quyen-rieng-tu.md')).toBe('/quyen-rieng-tu.md');
  });

  it('accepts /bai-viet/[slug].md and /xray/c-* normalized to .md', () => {
    expect(resolveAllowedMarkdownPath('/bai-viet/ai-automation-2026.md')).toBe(
      '/bai-viet/ai-automation-2026.md',
    );
    expect(resolveAllowedMarkdownPath('/bai-viet/viet-pro-guide')).toBe('/bai-viet/viet-pro-guide.md');
    expect(resolveAllowedMarkdownPath('/xray/c-0123456789ab')).toBe('/xray/c-0123456789ab.md');
    expect(resolveAllowedMarkdownPath('/xray/c-abcdef1234567890abcdef12.md')).toBe(
      '/xray/c-abcdef1234567890abcdef12.md',
    );
  });

  it('blocks scheme URLs, protocol-relative URLs, path traversal, admin, api, and non-c xray', () => {
    const blocked = [
      '',
      '   ',
      'https://evil.com/index.md',
      'http://tqd.me/index.md',
      'javascript:alert(1)',
      '//evil.com/index.md',
      '/bai-viet/../admin.md',
      '/bai-viet/%2e%2e/index.md',
      '/admin',
      '/admin/stats.md',
      '/api/chat',
      '/api/dl/stream',
      '/xray/abcdef123456',
      '/xray/x-0123456789ab',
      '/xray/c-12345',
      '/xray/c-ABCDEF123456',
      '/xray/c-0123456789ab?raw=1',
      '/index.md#frag',
      '/bai-viet/foo\\bar.md',
      '/khong-ton-tai.md',
    ];
    for (const candidate of blocked) {
      expect(resolveAllowedMarkdownPath(candidate), `should reject ${candidate}`).toBeNull();
    }
  });
});

describe('sliceMarkdownContent', () => {
  it('paginates markdown by offset and reports nextOffset', () => {
    const sample = 'A'.repeat(100);
    const first = sliceMarkdownContent(sample, 0, 40);
    expect(first.text.length).toBe(40);
    expect(first.offset).toBe(0);
    expect(first.nextOffset).toBe(40);
    expect(first.totalLength).toBe(100);

    const last = sliceMarkdownContent(sample, 80, 40);
    expect(last.text.length).toBe(20);
    expect(last.nextOffset).toBeNull();
  });
});

describe('searchEntries & formatSearchOutput', () => {
  const sampleEntries: SearchEntry[] = [
    { kind: 'section', title: 'Hồ sơ DũngTQ', url: '/ho-so', hint: 'Chuyên gia AI thực chiến' },
    { kind: 'product', title: 'Viết Pro', url: '/san-pham', hint: 'Skill viết tiếng Việt' },
    { kind: 'article', title: 'Tự động hóa quy trình', url: '/bai-viet/tu-dong-hoa', hint: 'Workflow AI' },
  ];

  it('matches Vietnamese queries accent-insensitively and ranks title hits higher', () => {
    const hits = searchEntries(sampleEntries, 'viet pro');
    expect(hits[0]?.title).toBe('Viết Pro');
  });

  it('filters by kind and formats bounded output with markdown hints', () => {
    const hits = searchEntries(sampleEntries, 'ai', 'article');
    expect(hits).toHaveLength(1);
    const formatted = formatSearchOutput(hits, 'ai');
    expect(formatted).toContain('/bai-viet/tu-dong-hoa.md');
    expect(formatted.length).toBeLessThanOrEqual(1500);
  });
});

describe('formatProductsOutput & validators', () => {
  it('formats catalog items cleanly and validates sections and presets', () => {
    const out = formatProductsOutput([
      { title: 'Viết Pro', url: '/san-pham', summary: 'Chuẩn hóa tiếng Việt tự nhiên', category: 'skill' },
      { title: 'Tải Video AI', url: '/tai-video', summary: 'Tải video đa nền tảng', category: 'tool' },
    ]);
    expect(out).toContain('Viết Pro');
    expect(out).toContain('/tai-video');
    expect(isAllowedSectionId('ho-so')).toBe(true);
    expect(isAllowedSectionId('admin')).toBe(false);
    expect(isAllowedPreset('720')).toBe(true);
    expect(isAllowedPreset('8k')).toBe(false);
  });

  it('always fetches same-origin requests with credentials: omit', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    vi.stubGlobal('fetch', mockFetch);
    await fetchSameOriginJson('/search.json');
    expect(mockFetch).toHaveBeenCalledWith(
      '/search.json',
      expect.objectContaining({ credentials: 'omit' }),
    );

    mockFetch.mockResolvedValueOnce(new Response('# Hello', { status: 200 }));
    await fetchSameOriginText('/index.md');
    expect(mockFetch).toHaveBeenLastCalledWith(
      '/index.md',
      expect.objectContaining({ credentials: 'omit' }),
    );
    vi.unstubAllGlobals();
  });
});
