import { describe, expect, it, vi } from 'vitest';
import { deleteMedia, sniffType } from './media';

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);

describe('sniffType', () => {
  it('reads magic bytes', () => {
    expect(sniffType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(sniffType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png');
    expect(sniffType(bytes(0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70))).toBe('video/mp4');
  });

  it('rejects SVG and HTML', () => {
    const enc = (t: string) => new TextEncoder().encode(t.padEnd(16, ' '));
    expect(sniffType(enc('<svg xmlns="x"/>'))).toBeNull();
    expect(sniffType(enc('<!doctype html>'))).toBeNull();
  });
});

describe('deleteMedia', () => {
  it('never deletes backups', async () => {
    const prepare = vi.fn();
    const del = vi.fn();
    const env = { DB: { prepare }, MEDIA: { delete: del } } as unknown as Env;
    expect(await deleteMedia(env, 'backups/2026-10-12.json')).toBe(false);
    expect(prepare).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });

  it('skips R2 when the key is not in the media table', async () => {
    const del = vi.fn();
    const first = vi.fn().mockResolvedValue(null);
    const env = { DB: { prepare: () => ({ bind: () => ({ first }) }) }, MEDIA: { delete: del } } as unknown as Env;
    expect(await deleteMedia(env, '2026/10/abc-x.png')).toBe(false);
    expect(del).not.toHaveBeenCalled();
  });
});
