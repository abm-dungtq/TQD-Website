// POST /api/dl/prepare: verifies itemTicket, charges download rate limit for public visitors, and queues muxing on Home Daemon.
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { apiError, jsonResponse, readBodyCapped } from '../../../lib/api';
import { COOKIE } from '../../../lib/auth';
import { sameOrigin } from '../../../lib/chat';
import {
  callDaemon,
  DEFAULT_DL_DAILY_CAP,
  daemonOnline,
  dlIpBucket,
  getDlTicketSecret,
  getVnDayKey,
  type ItemTicketPayload,
  MAX_DL_BODY_BYTES,
  PUBLIC_IP_PER_HOUR,
  PUBLIC_VISITOR_PER_HOUR,
  parsePrepareBody,
  resolveDlTier,
  signDlTicket,
  verifyDlTicket,
} from '../../../lib/dl';
import { hit } from '../../../lib/rate-limit';

const HOUR = 3600;
const DAY = 86_400;
const TASK_TICKET_TTL_SEC = 15 * 60;

const offline = () =>
  apiError(503, 'offline', 'Máy chủ tải video đang tạm nghỉ. Bạn thử lại sau ít phút nhé.');

const limited = (message: string, retryAfter: number) =>
  apiError(429, 'rate_limited', message, { retryAfter }, { 'Retry-After': String(Math.max(1, retryAfter)) });

export const POST: APIRoute = async ({ request, url, cookies }) => {
  if (!sameOrigin(request, url.origin)) {
    return apiError(403, 'forbidden', 'Yêu cầu không đến từ trang này.');
  }
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
    return apiError(415, 'unsupported_media_type', 'Chỉ nhận JSON.');
  }

  const callerTier = await resolveDlTier(env.DB, cookies.get(COOKIE)?.value);

  const text = await readBodyCapped(request, MAX_DL_BODY_BYTES);
  if (text === null) return apiError(413, 'too_large', 'Yêu cầu quá lớn.');

  const parsed = parsePrepareBody(text, callerTier);
  if ('error' in parsed) return apiError(400, 'invalid', parsed.error);

  const apiKey = env.DL_API_KEY;
  const baseUrl = env.DL_BASE_URL;
  const ticketSecret = getDlTicketSecret(env as { DL_HMAC_SECRET?: string; DL_API_KEY?: string });
  if (!apiKey || !baseUrl || !ticketSecret) return offline();

  const ticket = await verifyDlTicket<ItemTicketPayload>(parsed.itemTicket, ticketSecret);
  if (!ticket || ticket.kind !== 'item') {
    return apiError(400, 'invalid_ticket', 'Phiên tải của video này đã hết hạn (15 phút). Vui lòng bấm Phân tích lại.');
  }

  if (!(await daemonOnline(baseUrl, apiKey)).online) {
    return offline();
  }

  const effectiveTier = callerTier === 'admin' ? 'admin' : ticket.tier;
  if (effectiveTier === 'public') {
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const [visitor, address] = await Promise.all([
      hit(env.DB, `dl:v:${parsed.visitorId}`, PUBLIC_VISITOR_PER_HOUR, HOUR),
      hit(env.DB, `dl:ip:${await dlIpBucket(ip)}`, PUBLIC_IP_PER_HOUR, HOUR),
    ]);
    if (!visitor.allowed || !address.allowed) {
      return limited(
        'Bạn đã đạt giới hạn lượt tải miễn phí trong một giờ (15 lượt/giờ). Vui lòng thử lại sau.',
        Math.max(visitor.retryAfter, address.retryAfter),
      );
    }

    const dailyCap = Number(env.DL_DAILY_CAP) || DEFAULT_DL_DAILY_CAP;
    const daily = await hit(env.DB, `dl:day:${getVnDayKey()}`, dailyCap, DAY);
    if (!daily.allowed) {
      return limited(
        'Hệ thống đã phục vụ đủ lượt tải công khai trong hôm nay. Bạn thử lại vào ngày mai nhé.',
        daily.retryAfter,
      );
    }
  }

  let upstream: Response;
  try {
    upstream = await callDaemon(
      baseUrl,
      apiKey,
      '/prepare',
      {
        method: 'POST',
        body: JSON.stringify({
          url: ticket.url,
          title: parsed.title,
          formatId: parsed.formatId,
          kind: parsed.kind,
          allowGeneric: effectiveTier === 'admin',
          maxHeight: ticket.maxHeight,
          maxFilesizeMB: ticket.maxFilesizeMB,
          compatibilityMode: parsed.compatibilityMode,
        }),
      },
      15_000,
    );
  } catch {
    return offline();
  }

  const data = (await upstream.json().catch(() => null)) as { taskId?: string; status?: string; error?: string } | null;
  if (!upstream.ok || !data?.taskId) {
    const status = upstream.status === 400 || upstream.status === 429 ? upstream.status : 502;
    return apiError(status, 'prepare_failed', data?.error || 'Không thể khởi tạo tác vụ tải.');
  }

  const exp = Math.floor(Date.now() / 1000) + TASK_TICKET_TTL_SEC;
  const taskTicket = await signDlTicket(
    {
      kind: 'task',
      taskId: data.taskId,
      exp,
    },
    ticketSecret,
  );

  return jsonResponse({
    taskId: data.taskId,
    status: data.status ?? 'queued',
    taskTicket,
  });
};
