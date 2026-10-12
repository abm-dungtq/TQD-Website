import { describe, expect, it } from 'vitest';
import { parseTikTokId, playerUrl, resolveTikTokId } from './tiktok';

const ID = '7420000000000000001';

describe('parseTikTokId', () => {
  it.each([
    `https://www.tiktok.com/@ten.kenh/video/${ID}`,
    `https://tiktok.com/@ten.kenh/video/${ID}`,
    `https://m.tiktok.com/@ten.kenh/video/${ID}?is_from_webapp=1`,
    `https://www.tiktok.com/player/v1/${ID}`,
    `https://www.tiktok.com/embed/v2/${ID}`,
    ID,
  ])('reads %s', (input) => {
    expect(parseTikTokId(input)).toBe(ID);
  });

  it('rejects other hosts and photo posts', () => {
    expect(parseTikTokId(`https://evil.com/@a/video/${ID}`)).toBeNull();
    expect(parseTikTokId(`https://www.tiktok.com/@a/photo/${ID}`)).toBeNull();
    expect(parseTikTokId('123')).toBeNull();
  });
});

describe('resolveTikTokId', () => {
  it('follows a short link redirect', async () => {
    const fakeFetch = (async () =>
      new Response(null, { status: 301, headers: { Location: `https://www.tiktok.com/@a/video/${ID}?x=1` } })) as typeof fetch;
    expect(await resolveTikTokId('https://vm.tiktok.com/ZSabc/', fakeFetch)).toBe(ID);
  });

  it('returns null when the network fails', async () => {
    const failing = (async () => {
      throw new Error('offline');
    }) as typeof fetch;
    expect(await resolveTikTokId('https://www.tiktok.com/t/ZTabc/', failing)).toBeNull();
  });
});

it('builds the player URL', () => {
  expect(playerUrl(ID)).toBe(`https://www.tiktok.com/player/v1/${ID}?autoplay=1&rel=0`);
});
