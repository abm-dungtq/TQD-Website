import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { readBodyCapped } from '../../lib/api';
import {
  detectBot,
  detectDevice,
  sanitizePayload,
} from '../../lib/analytics/normalize';
import {
  computeVidDay,
  getVnDateString,
  resolveAnalyticsSalt,
  writeAnalyticsEvent,
} from '../../lib/analytics/server';

export const prerender = false;

const MAX_BODY_BYTES = 1024;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function checkBeaconRateLimit(key: string, maxPerMin = 120): boolean {
  const now = Date.now();
  if (rateBuckets.size > 5000) {
    const firstKey = rateBuckets.keys().next().value;
    if (firstKey) rateBuckets.delete(firstKey);
  }
  const existing = rateBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (existing.count >= maxPerMin) return false;
  existing.count += 1;
  return true;
}

export const POST: APIRoute = async (context) => {
  const { request } = context;
  const url = new URL(request.url);
  const secFetchSite = request.headers.get('sec-fetch-site');
  const origin = request.headers.get('origin');

  if (
    (origin && origin !== url.origin) ||
    (secFetchSite && secFetchSite !== 'same-origin' && secFetchSite !== 'none')
  ) {
    return new Response(null, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }

  const netKey =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '0.0.0.0';

  if (!checkBeaconRateLimit(`t:${netKey}`, 120)) {
    return new Response(null, { status: 429, headers: { 'Cache-Control': 'no-store' } });
  }

  const rawText = await readBodyCapped(request, MAX_BODY_BYTES);
  if (rawText === null || !rawText.trim()) {
    return new Response(null, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return new Response(null, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const sanitized = sanitizePayload(parsed, 'tqd.me');
  if (!sanitized.ok) {
    return new Response(null, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const d = sanitized.data;
  const ua = request.headers.get('user-agent') || '';
  const cfCountry =
    ((request as unknown as { cf?: { country?: string } }).cf?.country ||
      request.headers.get('cf-ipcountry') ||
      'XX')
      .slice(0, 2)
      .toUpperCase();

  const vnDate = getVnDateString();
  const salt = resolveAnalyticsSalt(env.ANALYTICS_SALT);
  const vidDay = await computeVidDay(salt, vnDate, netKey, ua, 'tqd.me');

  writeAnalyticsEvent(env.ANALYTICS, {
    site: 'tqd.me',
    event: d.event,
    section: d.section,
    pathTpl: d.pathTpl,
    path: d.path,
    refHost: d.refHost,
    utm: d.utm,
    country: cfCountry || 'XX',
    device: detectDevice(ua),
    sid: d.sid,
    vidDay,
    p1: d.p1,
    p2: d.p2,
    isBot: detectBot(ua, d.webdriver),
    pvId: d.pvId,
    engagedMs: d.engagedMs,
    maxScrollPct: d.maxScrollPct,
    latencyMs: 0,
    value: d.value,
  });

  return new Response(null, {
    status: 204,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
};
