import { describe, expect, it } from 'vitest';
import { featuredVideo, isVideoKey, listItems } from './content';

const row = {
  id: 1,
  kind: 'product',
  title: 'Viết Pro',
  date: null,
  summary: 's',
  tags: '["Skill","Codex"]',
  links: '[]',
  tiktok_id: null,
  cover_key: null,
  sort: 10,
  visible: 1,
};

const fakeDb = {
  prepare: () => ({ bind: () => ({ all: async () => ({ results: [row] }) }) }),
} as unknown as D1Database;

describe('listItems', () => {
  it('maps JSON columns and flags', async () => {
    const [item] = await listItems(fakeDb, 'product');
    expect(item.tags).toEqual(['Skill', 'Codex']);
    expect(item.visible).toBe(true);
    expect(item.date).toBeUndefined();
  });
});

describe('featuredVideo', () => {
  it('picks the first marked video and ignores marked photos', () => {
    const gallery = [
      { key: '2026/10/a.webp', caption: 'Ảnh', featured: true },
      { key: '2026/10/b.mp4', caption: 'Video 1' },
      { key: '2026/10/c.mp4', caption: 'Video 2', featured: true },
    ];
    expect(featuredVideo(gallery)?.key).toBe('2026/10/c.mp4');
    expect(featuredVideo(gallery.slice(0, 2))).toBeUndefined();
    expect(isVideoKey('2026/10/b.webm')).toBe(true);
    expect(isVideoKey('2026/10/a.webp')).toBe(false);
  });
});