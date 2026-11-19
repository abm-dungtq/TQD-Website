import { getVnDayOffset } from '../analytics/wae-client';
import {
  type GscDailyRow,
  type GscSnapshotInfo,
  saveSeoSnapshot,
  upsertGscDailyRows,
} from './store';

export interface GscAuthState {
  configured: boolean;
  mode: 'service_account' | 'oauth_refresh' | 'none';
  siteUrl: string;
  clientEmail?: string;
}

interface ServiceAccountJson {
  client_email?: string;
  private_key?: string;
  token_uri?: string;
}

export function getGscSiteUrl(env: Pick<Env, 'GSC_SITE_URL'>): string {
  const raw = env.GSC_SITE_URL?.trim();
  return raw || 'sc-domain:tqd.me';
}

function parseServiceAccount(raw: string | undefined): ServiceAccountJson | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccountJson;
    if (parsed.client_email && parsed.private_key) return parsed;
  } catch {
    return null;
  }
  return null;
}

export function getGscAuthState(env: Partial<Env>): GscAuthState {
  const siteUrl = getGscSiteUrl(env);
  const sa = parseServiceAccount(env.GSC_SERVICE_ACCOUNT_JSON);
  if (sa?.client_email && sa.private_key) {
    return {
      configured: true,
      mode: 'service_account',
      siteUrl,
      clientEmail: sa.client_email,
    };
  }
  if (env.GSC_CLIENT_ID?.trim() && env.GSC_CLIENT_SECRET?.trim() && env.GSC_REFRESH_TOKEN?.trim()) {
    return {
      configured: true,
      mode: 'oauth_refresh',
      siteUrl,
    };
  }
  return {
    configured: false,
    mode: 'none',
    siteUrl,
  };
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlEncodeText(text: string): string {
  return base64UrlEncodeBytes(new TextEncoder().encode(text));
}

function pemToPkcs8Buffer(pem: string): ArrayBuffer {
  const cleaned = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function getAccessTokenFromServiceAccount(
  sa: ServiceAccountJson,
  fetchImpl: typeof fetch,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token';
  const header = base64UrlEncodeText(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64UrlEncodeText(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/webmasters',
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claim}`;

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8Buffer(sa.private_key ?? ''),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsigned) as BufferSource,
  );
  const jwt = `${unsigned}.${base64UrlEncodeBytes(new Uint8Array(signature))}`;

  const res = await fetchImpl(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
    signal: AbortSignal.timeout(8000),
  });
  const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || `OAuth JWT error ${res.status}`);
  }
  return data.access_token;
}

async function getAccessTokenFromRefresh(env: Partial<Env>, fetchImpl: typeof fetch): Promise<string> {
  const res = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GSC_CLIENT_ID!.trim(),
      client_secret: env.GSC_CLIENT_SECRET!.trim(),
      refresh_token: env.GSC_REFRESH_TOKEN!.trim(),
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(8000),
  });
  const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || `OAuth refresh error ${res.status}`);
  }
  return data.access_token;
}

export async function getGscAccessToken(env: Partial<Env>, fetchImpl: typeof fetch = fetch): Promise<string> {
  const sa = parseServiceAccount(env.GSC_SERVICE_ACCOUNT_JSON);
  if (sa) return getAccessTokenFromServiceAccount(sa, fetchImpl);
  if (env.GSC_CLIENT_ID?.trim() && env.GSC_CLIENT_SECRET?.trim() && env.GSC_REFRESH_TOKEN?.trim()) {
    return getAccessTokenFromRefresh(env, fetchImpl);
  }
  throw new Error(
    'Chưa cấu hình khóa Google Search Console (GSC_SERVICE_ACCOUNT_JSON hoặc GSC_CLIENT_ID/GSC_CLIENT_SECRET/GSC_REFRESH_TOKEN).',
  );
}

async function fetchSitemaps(
  siteUrl: string,
  token: string,
  fetchImpl: typeof fetch,
): Promise<NonNullable<GscSnapshotInfo['sitemaps']>> {
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps`;
  const res = await fetchImpl(endpoint, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    sitemap?: Array<{
      path?: string;
      lastSubmitted?: string;
      lastDownloaded?: string;
      isPending?: boolean;
      warnings?: string | number;
      errors?: string | number;
    }>;
  };
  return (data.sitemap ?? [])
    .filter((s) => typeof s.path === 'string')
    .map((s) => ({
      path: s.path!,
      lastSubmitted: s.lastSubmitted ?? null,
      lastDownloaded: s.lastDownloaded ?? null,
      isPending: Boolean(s.isPending),
      warnings: Number(s.warnings ?? 0),
      errors: Number(s.errors ?? 0),
    }));
}

/** Pulls Google Search Console searchAnalytics + sitemaps into D1 (`seo_gsc_daily` + `seo_snapshots`). */
export async function syncGscSearchAnalytics(
  env: Env,
  opts: { days?: number; siteUrl?: string; fetchImpl?: typeof fetch } = {},
): Promise<{ rowsSynced: number; sitemaps: NonNullable<GscSnapshotInfo['sitemaps']>; syncedAt: string }> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const siteUrl = opts.siteUrl?.trim() || getGscSiteUrl(env);
  const days = Math.max(1, Math.min(90, Number(opts.days ?? 28)));
  const startDate = getVnDayOffset(days - 1);
  const endDate = getVnDayOffset(0);

  const token = await getGscAccessToken(env, fetchImpl);

  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const res = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      startDate,
      endDate,
      dimensions: ['date', 'query', 'page'],
      rowLimit: 2500,
      dataState: 'all',
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GSC query thất bại (${res.status}): ${text.slice(0, 200)}`);
  }

  const payload = (await res.json()) as {
    rows?: Array<{
      keys?: string[];
      clicks?: number;
      impressions?: number;
      ctr?: number;
      position?: number;
    }>;
  };

  const mapped: GscDailyRow[] = (payload.rows ?? [])
    .filter((r) => Array.isArray(r.keys) && r.keys.length >= 2)
    .map((r) => ({
      day: r.keys![0] ?? endDate,
      query: r.keys![1] ?? '',
      page: r.keys![2] ?? '',
      clicks: Number(r.clicks ?? 0),
      impressions: Number(r.impressions ?? 0),
      ctr: Number(r.ctr ?? 0),
      position: Number(r.position ?? 0),
    }));

  const rowsSynced = await upsertGscDailyRows(env.DB, siteUrl, mapped);
  const sitemaps = await fetchSitemaps(siteUrl, token, fetchImpl).catch(() => []);
  const syncedAt = new Date().toISOString();

  await saveSeoSnapshot(env.DB, 'gsc_status', {
    syncedAt,
    siteUrl,
    rowsSynced,
    sitemaps,
    lastError: null,
  } satisfies GscSnapshotInfo);

  return { rowsSynced, sitemaps, syncedAt };
}

/** Submits `https://tqd.me/sitemap.xml` directly to Google Search Console and refreshes sitemap status. */
export async function submitSitemapToGsc(
  env: Env,
  sitemapUrl = 'https://tqd.me/sitemap.xml',
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; sitemaps: NonNullable<GscSnapshotInfo['sitemaps']> }> {
  const siteUrl = getGscSiteUrl(env);
  const token = await getGscAccessToken(env, fetchImpl);
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(sitemapUrl)}`;

  const res = await fetchImpl(endpoint, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gửi sitemap lên GSC thất bại (${res.status}): ${text.slice(0, 200)}`);
  }

  const sitemaps = await fetchSitemaps(siteUrl, token, fetchImpl).catch(() => []);
  await saveSeoSnapshot(env.DB, 'gsc_status', {
    syncedAt: new Date().toISOString(),
    siteUrl,
    sitemaps,
    lastError: null,
  } satisfies GscSnapshotInfo);

  return { ok: true, sitemaps };
}

/** Nightly cron entry point: skips cleanly when GSC credentials are not yet configured. */
export async function syncGscNightlyIfConfigured(env: Env): Promise<void> {
  if (!getGscAuthState(env).configured) return;
  try {
    await syncGscSearchAnalytics(env, { days: 7 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await saveSeoSnapshot(env.DB, 'gsc_status', {
      syncedAt: new Date().toISOString(),
      siteUrl: getGscSiteUrl(env),
      lastError: msg.slice(0, 300),
    } satisfies GscSnapshotInfo).catch(() => {});
  }
}
