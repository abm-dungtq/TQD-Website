import { describe, expect, it } from 'vitest';
import { listItems } from './content';

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
