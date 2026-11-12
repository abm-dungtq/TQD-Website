/**
 * src/lib/analytics/normalize.ts
 * Bộ chuẩn hóa đường dẫn và kiểm duyệt dữ liệu thống kê cho `tqd.me`.
 * Cắt bỏ tuyệt đối query string, hash fragment và loại trừ hoàn toàn `/admin*`, `/api*`.
 */

import {
  ALLOWED_EVENTS,
  ALLOWED_PAYLOAD_KEYS,
  ALLOWED_UTM,
  type AnalyticsDevice,
  type AnalyticsEventName,
  type AnalyticsSection,
  type AnalyticsUtm,
  type SanitizedAnalyticsPayload,
} from './schema';

const STATIC_TQD_PATHS: Record<string, { section: AnalyticsSection; pathTpl: string }> = {
  '/': { section: 'home', pathTpl: '/' },
  '/ho-so': { section: 'home', pathTpl: '/ho-so' },
  '/san-pham': { section: 'tools', pathTpl: '/san-pham' },
  '/thu-vien': { section: 'gallery', pathTpl: '/thu-vien' },
  '/video-ai': { section: 'gallery', pathTpl: '/video-ai' },
  '/bai-viet': { section: 'articles', pathTpl: '/bai-viet' },
  '/lien-he': { section: 'other', pathTpl: '/lien-he' },
  '/tai-video': { section: 'tools', pathTpl: '/tai-video' },
  '/quyen-rieng-tu': { section: 'legal', pathTpl: '/quyen-rieng-tu' },
};

const ARTICLE_SLUG_RE = /^[a-z0-9-]{1,80}$/;
const EVENT_SET = new Set<string>(ALLOWED_EVENTS as readonly string[]);
const KEY_SET = new Set<string>(ALLOWED_PAYLOAD_KEYS as readonly string[]);
const UTM_SET = new Set<string>(ALLOWED_UTM as readonly string[]);

const ENUM_TOKEN_RE = /^[a-z0-9_-]{0,40}$/;
const ID_TOKEN_RE = /^[a-zA-Z0-9_-]{0,32}$/;

/**
 * Chuẩn hóa đường dẫn công khai của `tqd.me`.
 * Trả về `null` cho mọi đường dẫn `/admin*`, `/api*`, `/media*`, các tệp `.xml`, `.txt`, `.md`
 * hoặc các đường dẫn không nằm trong allowlist trang công khai.
 */
export function normalizeTqdPath(rawPath: string): {
  section: AnalyticsSection;
  pathTpl: string;
  path: string;
} | null {
  if (typeof rawPath !== 'string' || !rawPath) return null;

  let cleaned = rawPath.trim();
  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
    try {
      cleaned = new URL(cleaned).pathname;
    } catch {
      return null;
    }
  }

  const qIdx = cleaned.indexOf('?');
  if (qIdx >= 0) cleaned = cleaned.slice(0, qIdx);
  const hIdx = cleaned.indexOf('#');
  if (hIdx >= 0) cleaned = cleaned.slice(0, hIdx);

  if (!cleaned.startsWith('/')) return null;

  if (cleaned.length > 1 && cleaned.endsWith('/')) {
    cleaned = cleaned.replace(/\/+$/, '');
  }

  const lower = cleaned.toLowerCase();
  if (
    lower === '/admin' ||
    lower.startsWith('/admin/') ||
    lower === '/api' ||
    lower.startsWith('/api/') ||
    lower === '/media' ||
    lower.startsWith('/media/') ||
    /\.(xml|txt|md|json|svg|png|jpe?g|webp|ico|css|js|woff2?)$/i.test(lower)
  ) {
    return null;
  }

  const staticHit = STATIC_TQD_PATHS[cleaned];
  if (staticHit) {
    return {
      section: staticHit.section,
      pathTpl: staticHit.pathTpl,
      path: cleaned,
    };
  }

  const segments = cleaned.split('/').filter(Boolean);
  if (segments.length === 2 && segments[0] === 'bai-viet' && ARTICLE_SLUG_RE.test(segments[1])) {
    return {
      section: 'articles',
      pathTpl: '/bai-viet/[slug]',
      path: `/bai-viet/${segments[1]}`,
    };
  }
  if (segments.length === 2 && segments[0] === 'xray' && /^[a-zA-Z0-9_-]{6,32}$/.test(segments[1])) {
    return {
      section: 'tools',
      pathTpl: '/xray/[id]',
      path: `/xray/${segments[1]}`,
    };
  }

  return null;
}

export function normalizeRefHost(
  rawRef: string | undefined | null,
  selfHost = 'tqd.me',
): string {
  if (!rawRef || typeof rawRef !== 'string') return 'direct';
  const trimmed = rawRef.trim().toLowerCase();
  if (!trimmed || trimmed === 'direct') return 'direct';

  let host = trimmed;
  if (trimmed.includes('://')) {
    try {
      host = new URL(trimmed).hostname.toLowerCase();
    } catch {
      return 'direct';
    }
  } else {
    host = trimmed.split('/')[0]?.split('?')[0]?.split('#')[0] || '';
  }

  host = host.replace(/^www\./, '');
  const cleanSelf = selfHost.toLowerCase().replace(/^www\./, '');
  if (!host || host === cleanSelf) return 'direct';
  if (!/^[a-z0-9.-]{1,100}$/.test(host)) return 'direct';
  return host;
}

export function normalizeUtm(rawUtm: string | undefined | null): AnalyticsUtm {
  if (!rawUtm || typeof rawUtm !== 'string') return '';
  const lower = rawUtm.trim().toLowerCase();
  if (!lower) return '';
  if (UTM_SET.has(lower)) return lower as AnalyticsUtm;
  if (lower.includes('google') || lower === 'gg' || lower.startsWith('gg_')) return 'google';
  if (
    lower.includes('facebook') ||
    lower === 'fb' ||
    lower.startsWith('fb_') ||
    lower.startsWith('fb-') ||
    lower.includes('meta')
  ) {
    return 'facebook';
  }
  if (lower.includes('zalo')) return 'zalo';
  if (lower.includes('tiktok') || lower === 'tt' || lower.startsWith('tt_')) return 'tiktok';
  if (lower.includes('youtube') || lower === 'yt' || lower.startsWith('yt_')) return 'youtube';
  if (lower.includes('mail') || lower === 'newsletter') return 'email';
  return 'other';
}

export function detectBot(ua: string | undefined | null, webdriver?: boolean): '0' | '1' {
  if (webdriver) return '1';
  if (!ua || typeof ua !== 'string') return '1';
  const lower = ua.toLowerCase();
  if (
    /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|curl|wget|python|scrapy|httpclient|axios|playwright|puppeteer|phantomjs|facebookexternalhit|bytespider|gptbot|claudebot/.test(
      lower,
    )
  ) {
    return '1';
  }
  return '0';
}

export function detectDevice(ua: string | undefined | null): AnalyticsDevice {
  if (!ua || typeof ua !== 'string') return 'desktop';
  const lower = ua.toLowerCase();
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/.test(lower)) {
    return 'tablet';
  }
  if (/mobile|iphone|ipod|android.*mobile|windows phone|blackberry|opera mini|iemobile/.test(lower)) {
    return 'mobile';
  }
  return 'desktop';
}

export function sanitizePayload(
  raw: unknown,
  selfHost = 'tqd.me',
): { ok: true; data: SanitizedAnalyticsPayload } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'invalid_object' };
  }

  let serializedLength = 0;
  try {
    serializedLength = new TextEncoder().encode(JSON.stringify(raw)).byteLength;
  } catch {
    return { ok: false, error: 'unserializable' };
  }
  if (serializedLength > 1024) {
    return { ok: false, error: 'payload_too_large' };
  }

  const obj = raw as Record<string, unknown>;
  for (const k of Object.keys(obj)) {
    if (!KEY_SET.has(k)) {
      return { ok: false, error: `disallowed_key:${k}` };
    }
  }

  const e = obj.e;
  if (typeof e !== 'string' || !EVENT_SET.has(e)) {
    return { ok: false, error: 'invalid_event' };
  }

  const rawP = obj.p === undefined ? '/' : obj.p;
  if (typeof rawP !== 'string' || rawP.length > 256) {
    return { ok: false, error: 'invalid_path' };
  }
  const normPath = normalizeTqdPath(rawP);
  if (!normPath) {
    return { ok: false, error: 'disallowed_path' };
  }

  const rawP1 = obj.p1 === undefined ? '' : obj.p1;
  const rawP2 = obj.p2 === undefined ? '' : obj.p2;
  if (typeof rawP1 !== 'string' || !ENUM_TOKEN_RE.test(rawP1)) {
    return { ok: false, error: 'invalid_p1' };
  }
  if (typeof rawP2 !== 'string' || !ENUM_TOKEN_RE.test(rawP2)) {
    return { ok: false, error: 'invalid_p2' };
  }

  const rawSid = obj.s === undefined ? '' : obj.s;
  const rawPv = obj.pv === undefined ? '' : obj.pv;
  if (typeof rawSid !== 'string' || !ID_TOKEN_RE.test(rawSid)) {
    return { ok: false, error: 'invalid_sid' };
  }
  if (typeof rawPv !== 'string' || !ID_TOKEN_RE.test(rawPv)) {
    return { ok: false, error: 'invalid_pv' };
  }

  const rawMs = obj.ms === undefined ? 0 : obj.ms;
  if (typeof rawMs !== 'number' || !Number.isFinite(rawMs) || rawMs < 0 || rawMs > 1_800_000) {
    return { ok: false, error: 'invalid_ms' };
  }

  const rawSc = obj.sc === undefined ? 0 : obj.sc;
  if (typeof rawSc !== 'number' || !Number.isFinite(rawSc) || rawSc < 0 || rawSc > 100) {
    return { ok: false, error: 'invalid_sc' };
  }

  const rawVal = obj.val === undefined ? 0 : obj.val;
  if (typeof rawVal !== 'number' || !Number.isFinite(rawVal) || rawVal < 0 || rawVal > 100_000_000) {
    return { ok: false, error: 'invalid_val' };
  }

  const rawWb = obj.wb;
  if (rawWb !== undefined && typeof rawWb !== 'boolean') {
    return { ok: false, error: 'invalid_wb' };
  }

  const rawRef = typeof obj.r === 'string' ? obj.r : '';
  const rawUtm = typeof obj.u === 'string' ? obj.u : '';

  return {
    ok: true,
    data: {
      event: e as AnalyticsEventName,
      section: normPath.section,
      pathTpl: normPath.pathTpl,
      path: normPath.path,
      refHost: normalizeRefHost(rawRef, selfHost),
      utm: normalizeUtm(rawUtm),
      sid: rawSid,
      pvId: rawPv,
      p1: rawP1,
      p2: rawP2,
      engagedMs: Math.round(rawMs),
      maxScrollPct: Math.round(rawSc),
      value: rawVal,
      webdriver: Boolean(rawWb),
    },
  };
}
