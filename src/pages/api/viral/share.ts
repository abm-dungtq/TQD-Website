// POST /api/viral/share: Creates an immutable read-only permalink `/xray/[id]` backed by verified D1 transcript metadata.
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { apiError, jsonResponse, readBodyCapped } from '../../../lib/api';
import { COOKIE } from '../../../lib/auth';
import { sameOrigin } from '../../../lib/chat';
import { dlIpBucket, getVnDayKey, resolveDlTier } from '../../../lib/dl';
import { hit } from '../../../lib/rate-limit';
import { computeVietProScore } from '../../../lib/viet-pro-lint';
import {
  createViralShare,
  DEFAULT_VIRAL_DAILY_CAP,
  getCachedTranscript,
  MAX_VIRAL_BODY_BYTES,
  PUBLIC_SHARE_IP_PER_HOUR,
  PUBLIC_SHARE_VISITOR_PER_HOUR,
  sanitizePublicShareMarkdown,
  VIRAL_FORMATS,
  type ViralFormatKey,
} from '../../../lib/viral';

const HOUR = 3600;
const DAY = 86_400;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_FORMATS = new Set<string>(VIRAL_FORMATS.map((f) => f.key));

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

  const bodyText = await readBodyCapped(request, MAX_VIRAL_BODY_BYTES);
  if (bodyText === null) return apiError(413, 'too_large', 'Nội dung chia sẻ quá dài.');

  let raw: Record<string, unknown>;
  try {
    raw = (JSON.parse(bodyText) ?? {}) as Record<string, unknown>;
  } catch {
    return apiError(400, 'invalid', 'Dữ liệu JSON không hợp lệ.');
  }

  const visitorId = typeof raw.visitorId === 'string' && UUID_RE.test(raw.visitorId) ? raw.visitorId : '';
  if (tier === 'public' && !visitorId) {
    return apiError(400, 'invalid', 'Mã phiên trình duyệt không hợp lệ.');
  }

  const videoHash = typeof raw.videoHash === 'string' ? raw.videoHash.trim().toLowerCase() : '';
  if (!/^[a-f0-9]{16,64}$/.test(videoHash)) {
    return apiError(400, 'invalid', 'Mã video không hợp lệ.');
  }

  const xrayMarkdown = typeof raw.xrayMarkdown === 'string' ? raw.xrayMarkdown.trim().slice(0, 16_000) : '';
  const scriptMarkdown = typeof raw.scriptMarkdown === 'string' ? raw.scriptMarkdown.trim().slice(0, 16_000) : '';
  if (!xrayMarkdown && !scriptMarkdown) {
    return apiError(400, 'empty', 'Cần có ít nhất bản phân tích X-Quang hoặc kịch bản để tạo link chia sẻ.');
  }

  if (tier === 'public') {
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const dailyCap = Math.max(20, Number.parseInt(env.VIRAL_DAILY_CAP || '', 10) || DEFAULT_VIRAL_DAILY_CAP);
    const [visitor, address, daily] = await Promise.all([
      hit(env.DB, `viral:sh:v:${visitorId}`, PUBLIC_SHARE_VISITOR_PER_HOUR, HOUR),
      hit(env.DB, `viral:sh:ip:${await dlIpBucket(ip)}`, PUBLIC_SHARE_IP_PER_HOUR, HOUR),
      hit(env.DB, `viral:day:${getVnDayKey()}`, dailyCap, DAY),
    ]);
    if (!visitor.allowed || !address.allowed || !daily.allowed) {
      return limited(
        'Bạn đã tạo nhiều link chia sẻ trong một giờ. Vui lòng thử lại sau.',
        Math.max(visitor.retryAfter, address.retryAfter, daily.retryAfter),
      );
    }
  }

  // Anchor metadata strictly to verified D1 transcript row to prevent arbitrary external link/title spoofing
  const transcript = await getCachedTranscript(env.DB, videoHash);
  if (!transcript) {
    return apiError(404, 'not_found', 'Không tìm thấy dữ liệu gốc của video này.');
  }

  const cleanXray =
    tier === 'public' ? sanitizePublicShareMarkdown(xrayMarkdown, transcript.canonicalUrl) : xrayMarkdown;
  const cleanScript =
    tier === 'public' ? sanitizePublicShareMarkdown(scriptMarkdown, transcript.canonicalUrl) : scriptMarkdown;
  if (!cleanXray && !cleanScript) {
    return apiError(400, 'empty', 'Nội dung chia sẻ không hợp lệ.');
  }

  const rawFmt = typeof raw.formatKey === 'string' ? raw.formatKey.trim() : 'xray';
  const formatKey: ViralFormatKey | 'xray' = VALID_FORMATS.has(rawFmt) ? (rawFmt as ViralFormatKey) : 'xray';
  const industry = typeof raw.industry === 'string' ? raw.industry.trim().slice(0, 140) : '';
  const lintTarget = cleanScript || cleanXray;
  const vietProScore = computeVietProScore(lintTarget).score;

  const saved = await createViralShare(
    env.DB,
    {
      videoHash,
      platformLabel: transcript.platformLabel || transcript.platform,
      canonicalUrl: transcript.canonicalUrl,
      title: transcript.title,
      uploader: transcript.uploader,
      duration: transcript.duration,
      formatKey,
      industry,
      xrayMarkdown: cleanXray,
      scriptMarkdown: cleanScript,
      vietProScore,
    },
    tier,
  );

  return jsonResponse({
    ok: true,
    shareId: saved.shareId,
    curated: saved.shareId.startsWith('c-'),
    shareUrl: `${url.origin}/xray/${saved.shareId}`,
  });
};
