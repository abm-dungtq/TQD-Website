// POST /api/viral/generate: Streams Viral DNA X-Ray, Multi-Format Industry-Swap Rewrites, and 1-Click Viet-Pro Polish
// directly from OpenCode Go (`deepseek-v4.1-flash`) with <2ms Worker CPU overhead.
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { apiError, readBodyCapped } from '../../../lib/api';
import { COOKIE } from '../../../lib/auth';
import { sameOrigin } from '../../../lib/chat';
import { dlIpBucket, resolveDlTier } from '../../../lib/dl';
import { hit } from '../../../lib/rate-limit';
import {
  buildViralMessages,
  getCachedTranscript,
  MAX_VIRAL_BODY_BYTES,
  PUBLIC_GENERATE_IP_PER_HOUR,
  PUBLIC_GENERATE_VISITOR_PER_HOUR,
  parseGenerateBody,
  streamOpenCodeGo,
} from '../../../lib/viral';

const HOUR = 3600;

export const POST: APIRoute = async ({ request, url, cookies }) => {
  if (!sameOrigin(request, url.origin)) {
    return apiError(403, 'forbidden', 'Yêu cầu không đến từ trang này.');
  }
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
    return apiError(415, 'unsupported_media_type', 'Chỉ nhận JSON.');
  }

  const tier = await resolveDlTier(env.DB, cookies.get(COOKIE)?.value);

  const bodyText = await readBodyCapped(request, MAX_VIRAL_BODY_BYTES);
  if (bodyText === null) return apiError(413, 'too_large', 'Dữ liệu gửi lên quá dài.');

  const parsed = parseGenerateBody(bodyText, tier);
  if ('error' in parsed) return apiError(400, 'invalid', parsed.error);

  const openCodeKey = env.OPENCODE_GO_API_KEY;
  if (!openCodeKey) {
    return apiError(503, 'llm_unconfigured', 'Chưa cấu hình khóa kết nối AI viết kịch bản.');
  }

  if (tier === 'public') {
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const [visitor, address] = await Promise.all([
      hit(env.DB, `viral:gen:v:${parsed.visitorId}`, PUBLIC_GENERATE_VISITOR_PER_HOUR, HOUR),
      hit(env.DB, `viral:gen:ip:${await dlIpBucket(ip)}`, PUBLIC_GENERATE_IP_PER_HOUR, HOUR),
    ]);
    if (!visitor.allowed || !address.allowed) {
      const retryAfter = Math.max(visitor.retryAfter, address.retryAfter);
      return apiError(
        429,
        'rate_limited',
        'Bạn đã tạo nhiều kịch bản liên tiếp trong một giờ. Vui lòng nghỉ ít phút rồi thử tiếp nhé.',
        { retryAfter },
        { 'Retry-After': String(Math.max(1, retryAfter)) },
      );
    }
  }

  const transcript = await getCachedTranscript(env.DB, parsed.videoHash);
  if (!transcript) {
    return apiError(404, 'transcript_not_found', 'Không tìm thấy bản bóc băng của video này. Vui lòng bấm bóc băng lại.');
  }

  const messages = buildViralMessages(transcript, parsed);

  let upstream: Response;
  try {
    upstream = await streamOpenCodeGo({
      baseUrl: env.OPENCODE_GO_BASE_URL || 'https://opencode.ai/zen/go/v1',
      apiKey: openCodeKey,
      model: env.OPENCODE_GO_MODEL || 'deepseek-v4.1-flash',
      sessionKey: parsed.videoHash,
      messages,
    });
  } catch {
    return apiError(502, 'llm_timeout', 'Kết nối tới mô hình AI viết kịch bản bị gián đoạn. Bạn thử lại nhé.');
  }

  if (!upstream.ok || !upstream.body) {
    await upstream.body?.cancel().catch(() => {});
    return apiError(
      502,
      'llm_error',
      'Mô hình AI đang quá tải tạm thời. Bạn vui lòng bấm thử lại sau vài giây nhé.',
    );
  }

  // Pipe upstream SSE bytes untouched to keep Cloudflare Worker CPU well under 2ms
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
};
