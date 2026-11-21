// Video downloader gateway helpers: 2-tier access (public vs admin), HKDF-derived HMAC tickets, rate limits, and Home Daemon calls.
import { readSession } from './auth';
import { extractUrlsFromInput, isPlaylistOrProfileUrl, validateSafeMediaUrl } from './dl-platforms';

export type DlTier = 'public' | 'admin';

export interface TierLimits {
  maxHeight: number;
  maxFilesizeMB: number;
  maxBatchItems: number;
  allowCookies: boolean;
}

export const TIER_LIMITS: Record<DlTier, TierLimits> = {
  public: {
    maxHeight: 1080,
    maxFilesizeMB: 200,
    maxBatchItems: 25,
    allowCookies: false,
  },
  admin: {
    maxHeight: 2160,
    maxFilesizeMB: 2000,
    maxBatchItems: 100,
    allowCookies: true,
  },
};

export const PUBLIC_RESOLVE_VISITOR_PER_HOUR = 30;
export const PUBLIC_RESOLVE_IP_PER_HOUR = 60;
export const PUBLIC_VISITOR_PER_HOUR = 15;
export const PUBLIC_IP_PER_HOUR = 30;
export const DEFAULT_DL_DAILY_CAP = 150;
export const MAX_DL_BODY_BYTES = 16 * 1024;

const HEALTH_TIMEOUT_MS = 4_000;
const HEALTH_TTL_MS = 30_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const HKDF_SALT = new TextEncoder().encode('tqd.me:dl-hmac-salt:v1');
const HKDF_INFO = new TextEncoder().encode('tqd-dl-ticket-v1');

export interface ItemTicketPayload {
  kind: 'item';
  url: string;
  tier: DlTier;
  maxHeight: number;
  maxFilesizeMB: number;
  exp: number;
}

export interface TaskTicketPayload {
  kind: 'task';
  taskId: string;
  exp: number;
}

export interface StreamTicketPayload {
  kind: 'stream';
  taskId: string;
  exp: number;
}

export type DlTicketPayload = ItemTicketPayload | TaskTicketPayload | StreamTicketPayload;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array | null {
  try {
    const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

/** Derives a domain-separated HMAC-SHA256 key (`tqd-dl-ticket-v1`) via HKDF-SHA256 so raw `DL_API_KEY` is never exposed directly as an HMAC key. */
async function importHmacKey(secret: string): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    'HKDF',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: HKDF_SALT, info: HKDF_INFO },
    baseKey,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    false,
    ['sign', 'verify'],
  );
}

/** Resolves the secret material for signing/verifying downloader tickets (`DL_HMAC_SECRET || DL_API_KEY`). */
export function getDlTicketSecret(envObj: { DL_HMAC_SECRET?: string; DL_API_KEY?: string }): string | undefined {
  return envObj.DL_HMAC_SECRET || envObj.DL_API_KEY || undefined;
}

/** Returns current YYYY-MM-DD date string in Vietnam timezone (`Asia/Ho_Chi_Minh`). */
export function getVnDayKey(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now);
}

/** Signs a short-lived ticket (`<payloadB64Url>.<sigB64Url>`) using HKDF-derived HMAC-SHA256. */
export async function signDlTicket<T extends DlTicketPayload>(payload: T, secret: string): Promise<string> {
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const payloadB64 = toBase64Url(payloadBytes);
  const key = await importHmacKey(secret);
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
  return `${payloadB64}.${toBase64Url(new Uint8Array(sigBuf))}`;
}

/** Verifies an HKDF-derived HMAC-SHA256 ticket and checks `exp > nowSec`. Returns `null` if invalid or expired. */
export async function verifyDlTicket<T extends DlTicketPayload = DlTicketPayload>(
  ticket: string | null | undefined,
  secret: string | undefined,
): Promise<T | null> {
  if (!ticket || !secret) return null;
  const dot = ticket.indexOf('.');
  if (dot <= 0 || dot !== ticket.lastIndexOf('.')) return null;

  const payloadB64 = ticket.slice(0, dot);
  const sigB64 = ticket.slice(dot + 1);
  const sigBytes = fromBase64Url(sigB64);
  const payloadBytes = fromBase64Url(payloadB64);
  if (!sigBytes || !payloadBytes) return null;

  const key = await importHmacKey(secret);
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes as BufferSource, new TextEncoder().encode(payloadB64));
  if (!valid) return null;

  try {
    const parsed = JSON.parse(new TextDecoder().decode(payloadBytes)) as T;
    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof parsed?.exp !== 'number' || parsed.exp <= nowSec) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Short, non-reversible bucket key for an IP address in D1 `rate_limits`. */
export async function dlIpBucket(ip: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`tqd-dl:${ip}`));
  return [...new Uint8Array(digest).slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Determines whether the caller gets `admin` or `public` downloader tier.
 * Editorial Agent API keys (`articles:write`, `media:write`, `publish`) do NOT grant `admin` tier.
 */
export async function resolveDlTier(
  db: D1Database,
  sessionToken: string | undefined,
  _authHeader?: string | null,
): Promise<DlTier> {
  if (sessionToken && (await readSession(db, sessionToken))) return 'admin';
  return 'public';
}

export interface ResolveRequest {
  urls: string[];
  allowPlaylist: boolean;
  visitorId: string;
}

export function parseResolveBody(text: string, tier: DlTier): ResolveRequest | { error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: 'Dữ liệu gửi lên không phải JSON hợp lệ.' };
  }

  const { url, urls: rawUrls, allowPlaylist, visitorId } = (data ?? {}) as Record<string, unknown>;
  const cleanVisitorId = typeof visitorId === 'string' && UUID_RE.test(visitorId) ? visitorId : '';
  if (tier === 'public' && !cleanVisitorId) {
    return { error: 'Mã phiên trình duyệt (visitorId) không hợp lệ.' };
  }

  const allowGeneric = tier === 'admin';
  const candidateList: string[] = [];
  if (Array.isArray(rawUrls)) {
    for (const item of rawUrls) {
      if (typeof item === 'string' && item.trim()) candidateList.push(item.trim());
    }
  }
  if (typeof url === 'string' && url.trim()) {
    const extracted = extractUrlsFromInput(url, { allowGeneric });
    if (extracted.length > 0) {
      candidateList.push(...extracted);
    } else {
      candidateList.push(url.trim());
    }
  }

  if (candidateList.length === 0) {
    return { error: 'Vui lòng dán ít nhất một đường dẫn video hợp lệ (YouTube, TikTok, Facebook, Instagram...).' };
  }

  const validated: string[] = [];
  const seen = new Set<string>();
  for (const raw of candidateList) {
    const check = validateSafeMediaUrl(raw, { allowGeneric });
    if (!check.ok) return { error: check.error };
    if (!seen.has(check.url)) {
      seen.add(check.url);
      validated.push(check.url);
    }
  }

  const maxItems = TIER_LIMITS[tier].maxBatchItems;
  const boundedUrls = validated.slice(0, maxItems);
  const autoPlaylist = boundedUrls.length === 1 && isPlaylistOrProfileUrl(boundedUrls[0]);

  return {
    urls: boundedUrls,
    allowPlaylist: Boolean(allowPlaylist) || autoPlaylist,
    visitorId: cleanVisitorId || 'admin-session',
  };
}

export interface PrepareRequest {
  itemTicket: string;
  title: string;
  formatId: string;
  kind: 'video' | 'audio';
  compatibilityMode: boolean;
  visitorId: string;
}

export function parsePrepareBody(text: string, tier: DlTier): PrepareRequest | { error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: 'Dữ liệu gửi lên không phải JSON hợp lệ.' };
  }

  const { itemTicket, title, formatId, kind, compatibilityMode, visitorId } = (data ?? {}) as Record<string, unknown>;
  if (typeof itemTicket !== 'string' || !itemTicket.trim()) {
    return { error: 'Thiếu vé xác thực video (itemTicket).' };
  }
  const cleanVisitorId = typeof visitorId === 'string' && UUID_RE.test(visitorId) ? visitorId : '';
  if (tier === 'public' && !cleanVisitorId) {
    return { error: 'Mã phiên trình duyệt (visitorId) không hợp lệ.' };
  }

  const cleanKind = kind === 'audio' ? 'audio' : 'video';
  const cleanFormat = typeof formatId === 'string' && formatId.trim() ? formatId.trim().slice(0, 64) : 'best';
  const cleanTitle = typeof title === 'string' && title.trim() ? title.trim().slice(0, 140) : 'Video';

  return {
    itemTicket: itemTicket.trim(),
    title: cleanTitle,
    formatId: cleanFormat,
    kind: cleanKind,
    compatibilityMode: compatibilityMode !== false,
    visitorId: cleanVisitorId || 'admin-session',
  };
}

let daemonHealthCache: { at: number; online: boolean; version?: string } | null = null;

export async function daemonOnline(
  baseUrl: string,
  apiKey?: string,
): Promise<{ online: boolean; version?: string }> {
  if (daemonHealthCache && Date.now() - daemonHealthCache.at < HEALTH_TTL_MS) {
    return { online: daemonHealthCache.online, version: daemonHealthCache.version };
  }
  let online = false;
  let version: string | undefined;
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/health`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; version?: string };
      online = Boolean(data.ok ?? true);
      version = data.version;
    }
  } catch {
    online = false;
  }
  daemonHealthCache = { at: Date.now(), online, version };
  return { online, version };
}

export async function callDaemon(
  baseUrl: string,
  apiKey: string,
  path: string,
  init: RequestInit = {},
  timeoutMs = 25_000,
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${apiKey}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json; charset=utf-8');
  }
  return fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

/** Nightly cron: delete expired downloader rate-limit rows older than 2 days. */
export async function cleanupDlLimits(db: D1Database): Promise<void> {
  const cutoff = Math.floor(Date.now() / 1000) - 2 * 86_400;
  await db.prepare("DELETE FROM rate_limits WHERE bucket LIKE 'dl:%' AND window_start < ?1").bind(cutoff).run();
}
