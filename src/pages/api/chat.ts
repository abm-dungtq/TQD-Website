// POST /api/chat: forwards one visitor message to the GoClaw agent and streams its SSE reply back.
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { apiError, readBodyCapped } from '../../lib/api';
import {
  callGoclaw,
  DEFAULT_DAILY_CAP,
  goclawOnline,
  IP_PER_HOUR,
  ipBucket,
  MAX_BODY_BYTES,
  parseChatBody,
  sameOrigin,
  VISITOR_PER_HOUR,
} from '../../lib/chat';
import { recordChat, type ChatOutcome } from '../../lib/chat-stats';
import { hit } from '../../lib/rate-limit';

const HOUR = 3600;
const DAY = 86_400;

const offline = () => apiError(503, 'offline', 'Agent đang nghỉ. Bạn nhắn Zalo cho DũngTQ nhé.');
const limited = (message: string, retryAfter: number) =>
  apiError(429, 'rate_limited', message, { retryAfter }, { 'Retry-After': String(Math.max(1, retryAfter)) });

export const POST: APIRoute = async ({ request, url, locals }) => {
  if (!sameOrigin(request, url.origin)) return apiError(403, 'forbidden', 'Yêu cầu không đến từ trang này.');
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
    return apiError(415, 'unsupported_media_type', 'Chỉ nhận JSON.');
  }
  const text = await readBodyCapped(request, MAX_BODY_BYTES);
  if (text === null) return apiError(413, 'too_large', 'Tin nhắn quá dài.');
  const chat = parseChatBody(text);
  if ('error' in chat) return apiError(400, 'invalid', chat.error);

  // Counted after the response is sent; a failed count never affects the visitor.
  const count = (outcome: ChatOutcome) =>
    locals.cfContext.waitUntil(recordChat(env.DB, outcome, chat.visitorId).catch((e) => console.warn('chat stats', String(e))));

  const apiKey = env.GOCLAW_API_KEY;
  const baseUrl = env.GOCLAW_BASE_URL;
  // Checked before any limit is charged, so a day with the home server off does not use up the daily cap.
  if (!apiKey || !baseUrl || !(await goclawOnline(baseUrl))) {
    count('offline');
    return offline();
  }

  // Visitor and IP first, so blocked senders never use up the shared daily allowance.
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const [visitor, address] = await Promise.all([
    hit(env.DB, `chat:v:${chat.visitorId}`, VISITOR_PER_HOUR, HOUR),
    hit(env.DB, `chat:ip:${await ipBucket(ip)}`, IP_PER_HOUR, HOUR),
  ]);
  if (!visitor.allowed || !address.allowed) {
    count('limited');
    return limited('Bạn đã gửi nhiều tin trong một giờ. Thử lại sau hoặc nhắn Zalo cho DũngTQ.', Math.max(visitor.retryAfter, address.retryAfter));
  }
  const daily = await hit(env.DB, 'chat:day', Number(env.CHAT_DAILY_CAP) || DEFAULT_DAILY_CAP, DAY);
  if (!daily.allowed) {
    count('limited');
    return limited('Agent đã trả lời đủ số tin hôm nay. Bạn nhắn Zalo cho DũngTQ nhé.', daily.retryAfter);
  }

  let upstream: Response;
  try {
    upstream = await callGoclaw({ baseUrl, agent: env.GOCLAW_AGENT || 'dungtq-web', apiKey }, chat);
  } catch {
    count('failed');
    return offline();
  }
  if (upstream.status === 429) {
    count('failed');
    return apiError(503, 'busy', 'Agent đang bận, bạn thử lại sau ít phút nhé.', { retryAfter: 30 }, { 'Retry-After': '30' });
  }
  if (!upstream.ok || !upstream.body) {
    // Status only: a revoked key or a GoClaw error should not look like the server being off.
    console.warn('goclaw upstream', upstream.status);
    await upstream.body?.cancel();
    count('failed');
    return offline();
  }
  count('answered');
  // Pass the stream through untouched: parsing each chunk here would cost Worker CPU on long answers.
  return new Response(upstream.body, {
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' },
  });
};
