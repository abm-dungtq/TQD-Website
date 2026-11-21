// TikTok links → numeric video id → official player URL.
const ID = /^\d{15,21}$/;
const PATHS = [/^\/@[^/]+\/video\/(\d{15,21})\/?$/, /^\/player\/v1\/(\d{15,21})\/?$/, /^\/embed\/v2\/(\d{15,21})\/?$/];

const isTikTokHost = (host: string) => host === 'tiktok.com' || host === 'www.tiktok.com' || host === 'm.tiktok.com';

export function parseTikTokId(input: string): string | null {
  const text = input.trim();
  if (ID.test(text)) return text;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (!isTikTokHost(url.hostname)) return null;
  for (const re of PATHS) {
    const m = url.pathname.match(re);
    if (m) return m[1];
  }
  return null;
}

export function isTikTokShortLink(input: string): boolean {
  try {
    const url = new URL(input.trim());
    return (
      url.hostname === 'vm.tiktok.com' ||
      url.hostname === 'vt.tiktok.com' ||
      (url.hostname === 'www.tiktok.com' && url.pathname.startsWith('/t/'))
    );
  } catch {
    return false;
  }
}

/** Follows one redirect for short links (vm./vt./t/); other inputs are parsed directly. */
export async function resolveTikTokId(input: string, fetchFn: typeof fetch = fetch): Promise<string | null> {
  if (!isTikTokShortLink(input)) return parseTikTokId(input);
  try {
    const res = await fetchFn(input.trim(), { redirect: 'manual' });
    const location = res.headers.get('Location');
    return location ? parseTikTokId(location) : null;
  } catch {
    return null;
  }
}

export const playerUrl = (id: string): string => `https://www.tiktok.com/player/v1/${id}?autoplay=1&rel=0`;
