import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it.each([
    ['<script>alert(1)</script>', '<script'],
    ['<img src=x onerror=alert(1)>', 'onerror'],
    ['[bấm](javascript:alert(1))', 'javascript:'],
    ['![a](https://evil.example/x.png)', 'evil.example'],
  ])('strips %s', async (md, forbidden) => {
    expect(await renderMarkdown(md)).not.toContain(forbidden);
  });

  it('keeps local media images', async () => {
    const html = await renderMarkdown('![a](/media/2026/10/abc.png)');
    expect(html).toContain('src="/media/2026/10/abc.png"');
    expect(html).toContain('loading="lazy"');
  });

  it('turns a lone TikTok link into an embed placeholder without an iframe', async () => {
    const html = await renderMarkdown('https://www.tiktok.com/@a/video/7420000000000000001');
    expect(html).toContain('data-tiktok-id="7420000000000000001"');
    expect(html).not.toContain('<iframe');
  });

  it('marks external links', async () => {
    expect(await renderMarkdown('[x](https://example.com)')).toContain('rel="noopener nofollow ugc"');
  });

  it('leaves own links alone', async () => {
    expect(await renderMarkdown('[x](https://tqd.io.vn/bai-viet)')).not.toContain('ugc');
  });
});
