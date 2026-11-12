// POST /api/dl/resolve: probes single URL, playlist/profile, or multi-URL batch via Home Daemon and signs itemTickets.
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { apiError, jsonResponse, readBodyCapped } from '../../../lib/api';
import { COOKIE } from '../../../lib/auth';
import { sameOrigin } from '../../../lib/chat';
import {
  callDaemon,
  daemonOnline,
  dlIpBucket,
  getDlTicketSecret,
  MAX_DL_BODY_BYTES,
  PUBLIC_RESOLVE_IP_PER_HOUR,
  PUBLIC_RESOLVE_VISITOR_PER_HOUR,
  parseResolveBody,
  resolveDlTier,
  signDlTicket,
  TIER_LIMITS,
} from '../../../lib/dl';
import { hit } from '../../../lib/rate-limit';

const HOUR = 3600;
const ITEM_TICKET_TTL_SEC = 15 * 60;

const offline = () =>
  apiError(503, 'offline', 'Máy chủ tải video đang tạm nghỉ. Bạn thử lại sau ít phút hoặc nhắn Zalo cho DũngTQ nhé.');

const limited = (message: string, retryAfter: number) =>
  apiError(429, 'rate_limited', message, { retryAfter }, { 'Retry-After': String(Math.max(1, retryAfter)) });

export const POST: APIRoute = async ({ request, url, cookies }) => {
  if (!sameOrigin(request, url.origin)) {
    return apiError(403, 'forbidden', 'Yêu cầu không đến từ trang này.');
  }
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
    return apiError(415, 'unsupported_media_type', 'Chỉ nhận JSON.');
  }

  const tier = await resolveDlTier(env.DB, cookies.get(COOKIE)?.value);

  const text = await readBodyCapped(request, MAX_DL_BODY_BYTES);
  if (text === null) return apiError(413, 'too_large', 'Danh sách đường dẫn quá dài.');

  const parsed = parseResolveBody(text, tier);
  if ('error' in parsed) return apiError(400, 'invalid', parsed.error);

  const apiKey = env.DL_API_KEY;
  const baseUrl = env.DL_BASE_URL;
  const ticketSecret = getDlTicketSecret(env as { DL_HMAC_SECRET?: string; DL_API_KEY?: string });
  if (!apiKey || !baseUrl || !ticketSecret || !(await daemonOnline(baseUrl, apiKey)).online) {
    return offline();
  }

  if (tier === 'public') {
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const [visitor, address] = await Promise.all([
      hit(env.DB, `dl:res:v:${parsed.visitorId}`, PUBLIC_RESOLVE_VISITOR_PER_HOUR, HOUR),
      hit(env.DB, `dl:res:ip:${await dlIpBucket(ip)}`, PUBLIC_RESOLVE_IP_PER_HOUR, HOUR),
    ]);
    if (!visitor.allowed || !address.allowed) {
      return limited(
        'Bạn đã quét nhiều đường dẫn trong một giờ. Vui lòng đợi ít phút rồi thử lại.',
        Math.max(visitor.retryAfter, address.retryAfter),
      );
    }
  }

  const limits = TIER_LIMITS[tier];
  let upstream: Response;
  try {
    upstream = await callDaemon(
      baseUrl,
      apiKey,
      '/resolve',
      {
        method: 'POST',
        body: JSON.stringify({
          urls: parsed.urls,
          allowPlaylist: parsed.allowPlaylist,
          allowGeneric: tier === 'admin',
          maxItems: limits.maxBatchItems,
          maxHeight: limits.maxHeight,
        }),
      },
      28_000,
    );
  } catch {
    return offline();
  }

  const data = (await upstream.json().catch(() => null)) as Record<string, unknown> | null;
  if (!upstream.ok || !data) {
    const msg = typeof data?.error === 'string' ? data.error : 'Không thể phân tích đường dẫn này.';
    return apiError(upstream.status === 400 ? 400 : 502, 'resolve_failed', msg);
  }

  const exp = Math.floor(Date.now() / 1000) + ITEM_TICKET_TTL_SEC;

  if (data.mode === 'single' && typeof data.url === 'string') {
    data.itemTicket = await signDlTicket(
      {
        kind: 'item',
        url: data.url,
        tier,
        maxHeight: limits.maxHeight,
        maxFilesizeMB: limits.maxFilesizeMB,
        exp,
      },
      ticketSecret,
    );
  } else if (Array.isArray(data.entries)) {
    const signedEntries = await Promise.all(
      data.entries.map(async (rawEntry) => {
        const entry = (rawEntry ?? {}) as Record<string, unknown>;
        if (typeof entry.url === 'string') {
          entry.itemTicket = await signDlTicket(
            {
              kind: 'item',
              url: entry.url,
              tier,
              maxHeight: limits.maxHeight,
              maxFilesizeMB: limits.maxFilesizeMB,
              exp,
            },
            ticketSecret,
          );
        }
        return entry;
      }),
    );
    data.entries = signedEntries;
  }

  return jsonResponse({
    ...data,
    tier,
    limits,
  });
};
