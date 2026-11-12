// Platform detection, URL normalization, batch extraction, and SSRF guard for the video downloader.
// Kept dependency-free and without non-erasable TypeScript syntax so Node >= 22 scripts can import it directly.

export type PlatformMediaKind = 'shorts' | 'video' | 'playlist' | 'audio';

export interface Platform {
  key: string;
  label: string;
  icon: string;
  mediaKind: PlatformMediaKind;
}

export interface ValidateMediaUrlOptions {
  /** Defaults to false (strict PLATFORMS domain allowlist for public tier). */
  allowGeneric?: boolean;
}

export const PLATFORMS: Array<{ hosts: string[]; key: string; label: string; icon: string }> = [
  { hosts: ['youtube.com', 'youtu.be', 'music.youtube.com'], key: 'youtube', label: 'YouTube', icon: '📺' },
  { hosts: ['tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'], key: 'tiktok', label: 'TikTok', icon: '🎵' },
  { hosts: ['douyin.com', 'iesdouyin.com'], key: 'douyin', label: 'Douyin', icon: '🏮' },
  { hosts: ['facebook.com', 'fb.watch', 'fb.gg', 'fb.com'], key: 'facebook', label: 'Facebook', icon: '📘' },
  { hosts: ['instagram.com', 'instagr.am'], key: 'instagram', label: 'Instagram', icon: '📷' },
  { hosts: ['x.com', 'twitter.com', 't.co'], key: 'x', label: 'X / Twitter', icon: '🐦' },
  { hosts: ['threads.net', 'threads.com'], key: 'threads', label: 'Threads', icon: '🧵' },
  { hosts: ['reddit.com', 'redd.it', 'v.redd.it'], key: 'reddit', label: 'Reddit', icon: '🤖' },
  { hosts: ['twitch.tv', 'clips.twitch.tv'], key: 'twitch', label: 'Twitch', icon: '🎮' },
  { hosts: ['vimeo.com', 'player.vimeo.com'], key: 'vimeo', label: 'Vimeo', icon: '🎬' },
  { hosts: ['bilibili.com', 'b23.tv'], key: 'bilibili', label: 'Bilibili', icon: '📺' },
  { hosts: ['soundcloud.com', 'on.soundcloud.com'], key: 'soundcloud', label: 'SoundCloud', icon: '🎧' },
  { hosts: ['dailymotion.com', 'dai.ly'], key: 'dailymotion', label: 'Dailymotion', icon: '🎞️' },
  { hosts: ['pinterest.com', 'pin.it'], key: 'pinterest', label: 'Pinterest', icon: '📌' },
];

const REBINDING_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.lan',
  '.home',
  '.arpa',
  '.nip.io',
  '.sslip.io',
  '.xip.io',
  '.traefik.me',
  '.localtest.me',
  '.lvh.me',
];

const TRACKING_PARAMS = [
  'si',
  'feature',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'igshid',
  'igsh',
  'is_from_webapp',
  'sender_device',
];

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function isPrivateOrReservedIpv4Bytes(a: number, b: number, c: number, d: number): boolean {
  if ([a, b, c, d].some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // RFC 3927 Link-Local / Cloud Metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC 1918
  if (a === 192 && b === 168) return true; // RFC 1918
  if (a === 100 && b >= 64 && b <= 127) return true; // RFC 6598 CGNAT 100.64.0.0/10
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true; // IETF / TEST-NET-1
  if (a === 192 && b === 88 && c === 99) return true; // 6to4 Relay Anycast
  if (a === 198 && (b === 18 || b === 19)) return true; // Benchmarking 198.18.0.0/15
  if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // Multicast & Reserved
  return false;
}

function isPrivateOrReservedIpv4(host: string): boolean {
  const m = IPV4_RE.exec(host);
  if (!m) return false;
  return isPrivateOrReservedIpv4Bytes(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]));
}

/** Parses an IPv6 address (without brackets) into 8 16-bit groups, or null if invalid. */
function parseIpv6Groups(raw: string): number[] | null {
  const zoneIdx = raw.indexOf('%');
  const clean = (zoneIdx >= 0 ? raw.slice(0, zoneIdx) : raw).toLowerCase();
  if (!clean || /[^0-9a-f:.]/.test(clean)) return null;

  let working = clean;
  const lastColon = working.lastIndexOf(':');
  if (lastColon >= 0 && working.slice(lastColon + 1).includes('.')) {
    const v4 = IPV4_RE.exec(working.slice(lastColon + 1));
    if (!v4) return null;
    const nums = [Number(v4[1]), Number(v4[2]), Number(v4[3]), Number(v4[4])];
    if (nums.some((n) => n < 0 || n > 255)) return null;
    const hi = ((nums[0] << 8) | nums[1]).toString(16);
    const lo = ((nums[2] << 8) | nums[3]).toString(16);
    working = `${working.slice(0, lastColon + 1)}${hi}:${lo}`;
  }

  const dblParts = working.split('::');
  if (dblParts.length > 2) return null;

  const parsePart = (part: string): number[] | null => {
    if (!part) return [];
    const tokens = part.split(':');
    const out: number[] = [];
    for (const t of tokens) {
      if (!/^[0-9a-f]{1,4}$/.test(t)) return null;
      out.push(Number.parseInt(t, 16));
    }
    return out;
  };

  if (dblParts.length === 1) {
    const groups = parsePart(dblParts[0]);
    return groups && groups.length === 8 ? groups : null;
  }

  const left = parsePart(dblParts[0]);
  const right = parsePart(dblParts[1]);
  if (!left || !right || left.length + right.length >= 8) return null;
  const zeros = new Array<number>(8 - left.length - right.length).fill(0);
  return [...left, ...zeros, ...right];
}

function isPrivateOrReservedIpv6Groups(g: number[]): boolean {
  // Unspecified ::/128 and Loopback ::1/128 and IPv4-compatible ::/96
  if (g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0) {
    if (g[5] === 0) return true; // ::/96 (includes ::, ::1, and deprecated IPv4-compatible [::7f00:1])
    if (g[5] === 0xffff) {
      // IPv4-mapped ::ffff:0:0/96
      return isPrivateOrReservedIpv4Bytes(g[6] >> 8, g[6] & 0xff, g[7] >> 8, g[7] & 0xff);
    }
  }
  // Discard-only 100::/64
  if (g[0] === 0x0100 && g[1] === 0 && g[2] === 0 && g[3] === 0) return true;
  // NAT64 Well-Known Prefix 64:ff9b::/96 and Local-Use NAT64 64:ff9b:1::/48
  if (g[0] === 0x0064 && g[1] === 0xff9b) {
    if (g[2] === 1) return true;
    if (g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0) {
      return isPrivateOrReservedIpv4Bytes(g[6] >> 8, g[6] & 0xff, g[7] >> 8, g[7] & 0xff);
    }
  }
  // IETF / Teredo (2001:0000::/32), Benchmarking (2001:2::/48), Orchid (2001:10::/28), Documentation (2001:db8::/32)
  if (g[0] === 0x2001) {
    if (g[1] === 0x0000) return true;
    if (g[1] === 0x0002 && g[2] === 0) return true;
    if ((g[1] & 0xfff0) === 0x0010 || (g[1] & 0xfff0) === 0x0020) return true;
    if (g[1] === 0x0db8) return true;
  }
  // 6to4 2002::/16 (embeds IPv4 in g[1], g[2]; deprecated anycast / SSRF vector)
  if (g[0] === 0x2002) return true;
  // Unique Local fc00::/7
  if ((g[0] & 0xfe00) === 0xfc00) return true;
  // Link-Local fe80::/10 and deprecated Site-Local fec0::/10
  if ((g[0] & 0xffc0) === 0xfe80 || (g[0] & 0xffc0) === 0xfec0) return true;
  // Multicast ff00::/8
  if ((g[0] & 0xff00) === 0xff00) return true;
  return false;
}

/** Checks whether a resolved IPv4 or IPv6 literal belongs to any private, loopback, tunnel, or reserved range. */
export function isPrivateOrReservedIp(ip: string): boolean {
  const trimmed = (ip ?? '').trim().replace(/^\[|\]$/g, '');
  if (!trimmed) return true;
  if (IPV4_RE.test(trimmed)) return isPrivateOrReservedIpv4(trimmed);
  const groups = parseIpv6Groups(trimmed);
  if (!groups) return true;
  return isPrivateOrReservedIpv6Groups(groups);
}

/** Checks whether hostname matches one of the supported media platforms in `PLATFORMS`. */
export function isAllowedMediaHost(hostname: string): boolean {
  const lower = (hostname ?? '').toLowerCase().replace(/\.$/, '');
  if (!lower) return false;
  return PLATFORMS.some((entry) => entry.hosts.some((h) => lower === h || lower.endsWith(`.${h}`)));
}

function isPrivateOrReservedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/\.$/, '');
  if (!lower) return true;
  if (lower === 'localhost' || REBINDING_SUFFIXES.some((s) => lower.endsWith(s))) {
    return true;
  }
  // IPv6 literal in URL hostname is wrapped in brackets: [::1]
  if (lower.startsWith('[') && lower.endsWith(']')) {
    const groups = parseIpv6Groups(lower.slice(1, -1));
    if (!groups) return true;
    // Also block NAT64 literal URLs outright even if embedding a public IP
    if (groups[0] === 0x0064 && groups[1] === 0xff9b) return true;
    return isPrivateOrReservedIpv6Groups(groups);
  }
  // Reject bare single-word hostnames or numeric/hex/octal integer IPs like 2130706433 or 0x7f000001
  if (!lower.includes('.') || /^\d+$/.test(lower) || /^0x[0-9a-f]+$/i.test(lower)) {
    return true;
  }
  // Reject dotted octal/hex IPv4 bypasses like 0177.0.0.1 or 0x7f.0.0.1
  if (/^(?:0x[0-9a-f]+|\d+)(?:\.(?:0x[0-9a-f]+|\d+)){1,3}$/i.test(lower) && !IPV4_RE.test(lower)) {
    return true;
  }
  if (IPV4_RE.test(lower)) {
    return isPrivateOrReservedIpv4(lower);
  }
  return false;
}

export function normalizeMediaUrl(input: string): string {
  const trimmed = input.trim();
  try {
    const u = new URL(trimmed);
    for (const param of TRACKING_PARAMS) {
      u.searchParams.delete(param);
    }
    return u.toString();
  } catch {
    return trimmed;
  }
}

/** Validates that a URL is a safe http(s) media URL (blocks SSRF, local/tunnel IPs, rebinding domains, and unlisted hosts on public tier). */
export function validateSafeMediaUrl(
  raw: string,
  opts: ValidateMediaUrlOptions = {},
): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return { ok: false, error: 'Đường dẫn URL trống.' };
  if (trimmed.length > 2048) return { ok: false, error: 'Đường dẫn URL quá dài (tối đa 2048 ký tự).' };

  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return { ok: false, error: 'Đường dẫn URL không đúng định dạng.' };
  }

  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, error: 'Chỉ hỗ trợ đường dẫn http:// hoặc https://.' };
  }
  if (u.username || u.password) {
    return { ok: false, error: 'Đường dẫn không được chứa thông tin đăng nhập.' };
  }
  if (isPrivateOrReservedHost(u.hostname)) {
    return { ok: false, error: 'Không cho phép truy cập máy chủ nội bộ hoặc địa chỉ IP riêng.' };
  }
  if (!opts.allowGeneric && !isAllowedMediaHost(u.hostname)) {
    return {
      ok: false,
      error:
        'Chỉ hỗ trợ đường dẫn từ các nền tảng video được hỗ trợ (YouTube, TikTok, Douyin, Facebook, Instagram, X, Threads, Reddit, Twitch, Vimeo, Bilibili, SoundCloud, Dailymotion, Pinterest).',
    };
  }

  return { ok: true, url: normalizeMediaUrl(u.toString()) };
}

export function isProbablyUrl(input: string, opts?: ValidateMediaUrlOptions): boolean {
  return validateSafeMediaUrl(input, opts).ok;
}

export function isShortsOrReelsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    const p = u.pathname.toLowerCase();
    if (p.includes('/shorts/') || p.includes('/reel/') || p.includes('/reels/') || p.includes('/stories/')) {
      return true;
    }
    if ((h === 'tiktok.com' || h.endsWith('.tiktok.com')) && p.includes('/video/')) {
      return true;
    }
    if (h === 'vm.tiktok.com' || h === 'vt.tiktok.com' || h.includes('douyin.com')) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function isPlaylistOrProfileUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    const p = u.pathname.toLowerCase().replace(/\/+$/, '');
    if (p.includes('/playlist') || (u.searchParams.has('list') && !u.searchParams.has('v') && !p.includes('/shorts/'))) {
      return true;
    }
    if (p.includes('/sets/')) return true; // SoundCloud set/playlist
    // YouTube channel / profile tabs: /@handle, /@handle/videos, /@handle/shorts, /channel/..., /c/...
    if (h === 'youtube.com' || h.endsWith('.youtube.com')) {
      if (/^\/@[^/]+(\/(videos|shorts|streams|playlists|releases))?$/.test(p)) return true;
      if (/^\/(channel|c|user)\/[^/]+(\/(videos|shorts|streams|playlists))?$/.test(p)) return true;
    }
    // TikTok user profile: tiktok.com/@username (without /video/ or /photo/)
    if (h === 'tiktok.com' || h.endsWith('.tiktok.com')) {
      if (/^\/@[^/]+$/.test(p)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function detectPlatform(url: string): Platform {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { key: 'unknown', label: 'Không rõ', icon: '🌐', mediaKind: 'video' };
  }

  const hostname = u.hostname.toLowerCase();
  const isShorts = isShortsOrReelsUrl(url);
  const isList = isPlaylistOrProfileUrl(url);

  for (const entry of PLATFORMS) {
    if (entry.hosts.some((h) => hostname === h || hostname.endsWith(`.${h}`))) {
      let label = entry.label;
      let icon = entry.icon;
      let mediaKind: PlatformMediaKind = 'video';

      if (hostname === 'music.youtube.com' || entry.key === 'soundcloud') {
        label = hostname === 'music.youtube.com' ? 'YouTube Music' : 'SoundCloud';
        icon = '🎧';
        mediaKind = isList ? 'playlist' : 'audio';
      } else if (isList) {
        label = `${entry.label} Playlist / Profile`;
        icon = '📂';
        mediaKind = 'playlist';
      } else if (isShorts) {
        if (entry.key === 'youtube') label = 'YouTube Shorts';
        else if (entry.key === 'facebook') label = 'Facebook Reels';
        else if (entry.key === 'instagram') label = 'Instagram Reels';
        icon = '📱';
        mediaKind = 'shorts';
      }

      return { key: entry.key, label, icon, mediaKind };
    }
  }

  return {
    key: 'generic',
    label: hostname.replace(/^www\./, ''),
    icon: isList ? '📂' : isShorts ? '📱' : '🌐',
    mediaKind: isList ? 'playlist' : isShorts ? 'shorts' : 'video',
  };
}

/** Extracts unique, validated, normalized http(s) URLs from single-line or multi-line input. */
export function extractUrlsFromInput(raw: string, opts?: ValidateMediaUrlOptions): string[] {
  if (!raw) return [];
  const matches = raw.match(/https?:\/\/[^\s"'<>]+/gi) ?? [];
  const unique = new Set<string>();
  for (const m of matches) {
    const clean = m.replace(/[),.;]+$/, '');
    const check = validateSafeMediaUrl(clean, opts);
    if (check.ok) {
      unique.add(check.url);
    }
  }
  return Array.from(unique);
}

export interface CanonicalMediaKey {
  platform: string;
  canonicalId: string;
  canonicalUrl: string;
}

/**
 * Extracts a stable, tracking-free canonical key (`platform:id` when possible, otherwise normalized URL)
 * so D1 transcript caching hits across short links, mobile links, and tracking parameters.
 */
export function canonicalizeMediaKey(rawUrl: string, resolvedId?: string): CanonicalMediaKey {
  const normalized = normalizeMediaUrl(rawUrl);
  const detected = detectPlatform(normalized);
  const cleanResolvedId = typeof resolvedId === 'string' ? resolvedId.trim() : '';

  try {
    const u = new URL(normalized);
    const host = u.hostname.toLowerCase();
    const path = u.pathname.replace(/\/+$/, '');

    // YouTube: watch?v=ID, youtu.be/ID, /shorts/ID, /live/ID
    if (detected.key === 'youtube') {
      const vParam = u.searchParams.get('v');
      const shortMatch =
        /^\/(?:shorts|live|embed)\/([a-zA-Z0-9_-]{8,16})/.exec(path) ||
        (host === 'youtu.be' ? /^\/([a-zA-Z0-9_-]{8,16})/.exec(path) : null);
      const ytId = vParam || shortMatch?.[1] || cleanResolvedId;
      if (ytId) {
        return {
          platform: 'youtube',
          canonicalId: `youtube:${ytId}`,
          canonicalUrl: path.startsWith('/shorts/')
            ? `https://www.youtube.com/shorts/${ytId}`
            : `https://www.youtube.com/watch?v=${ytId}`,
        };
      }
    }

    // TikTok: /@user/video/1234567890 or /v/1234567890
    if (detected.key === 'tiktok') {
      const ttMatch = /\/(?:video|photo|v)\/(\d{8,24})/.exec(path);
      const ttId = ttMatch?.[1] || cleanResolvedId;
      if (ttId) {
        return {
          platform: 'tiktok',
          canonicalId: `tiktok:${ttId}`,
          canonicalUrl: `${u.origin}${path}`,
        };
      }
    }

    // Douyin: /video/123456 or ?modal_id=123456
    if (detected.key === 'douyin') {
      const modalId = u.searchParams.get('modal_id');
      const dyMatch = /\/video\/(\d{8,24})/.exec(path);
      const dyId = modalId || dyMatch?.[1] || cleanResolvedId;
      if (dyId) {
        return {
          platform: 'douyin',
          canonicalId: `douyin:${dyId}`,
          canonicalUrl: `https://www.douyin.com/video/${dyId}`,
        };
      }
    }

    // Facebook Reels / Videos
    if (detected.key === 'facebook') {
      const fbReel = /\/(?:reel|reels|videos)\/([a-zA-Z0-9_-]{6,32})/.exec(path);
      const fbId = fbReel?.[1] || u.searchParams.get('v') || cleanResolvedId;
      if (fbId) {
        return {
          platform: 'facebook',
          canonicalId: `facebook:${fbId}`,
          canonicalUrl: `${u.origin}${path}${u.searchParams.get('v') ? `?v=${u.searchParams.get('v')}` : ''}`,
        };
      }
    }

    // Instagram Reels / Posts
    if (detected.key === 'instagram') {
      const igMatch = /\/(?:reel|reels|p|tv)\/([a-zA-Z0-9_-]{5,24})/.exec(path);
      const igId = igMatch?.[1] || cleanResolvedId;
      if (igId) {
        return {
          platform: 'instagram',
          canonicalId: `instagram:${igId}`,
          canonicalUrl: `https://www.instagram.com/reel/${igId}/`,
        };
      }
    }

    // X / Twitter status
    if (detected.key === 'x') {
      const xMatch = /\/status\/(\d{8,24})/.exec(path);
      const xId = xMatch?.[1] || cleanResolvedId;
      if (xId) {
        return {
          platform: 'x',
          canonicalId: `x:${xId}`,
          canonicalUrl: `https://x.com/i/status/${xId}`,
        };
      }
    }

    if (cleanResolvedId && detected.key !== 'unknown' && detected.key !== 'generic') {
      return {
        platform: detected.key,
        canonicalId: `${detected.key}:${cleanResolvedId}`,
        canonicalUrl: normalized,
      };
    }
  } catch {
    // fallback to normalized URL below
  }

  return {
    platform: detected.key,
    canonicalId: `url:${normalized}`,
    canonicalUrl: normalized,
  };
}

/** Computes a compact 24-hex SHA-256 video hash from a canonical media key. */
export async function computeVideoHash(rawUrl: string, resolvedId?: string): Promise<string> {
  const { canonicalId } = canonicalizeMediaKey(rawUrl, resolvedId);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`tqd-viral:${canonicalId}`));
  return [...new Uint8Array(digest).slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
