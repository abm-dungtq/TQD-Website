// POST /api/viral/transcribe: D1 cache-first hybrid transcript engine (VPS yt-dlp subs + Workers AI Whisper Turbo).
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { apiError, jsonResponse, readBodyCapped } from '../../../lib/api';
import { COOKIE } from '../../../lib/auth';
import { sameOrigin } from '../../../lib/chat';
import { callDaemon, daemonOnline, dlIpBucket, getVnDayKey, resolveDlTier } from '../../../lib/dl';
import { hit } from '../../../lib/rate-limit';
import {
  canonicalizeMediaKey,
  computeVideoHash,
  DEFAULT_VIRAL_DAILY_CAP,
  detectPlatform,
  getCachedTranscript,
  getViralMaxDuration,
  MAX_VIRAL_BODY_BYTES,
  MAX_WHISPER_AUDIO_SEC,
  normalizeWhisperOutput,
  PUBLIC_TRANSCRIBE_IP_PER_HOUR,
  PUBLIC_TRANSCRIBE_VISITOR_PER_HOUR,
  parseTranscribeBody,
  saveTranscriptCache,
} from '../../../lib/viral';

const HOUR = 3600;
const DAY = 86_400;
const MAX_WHISPER_BASE64_CHARS = 4_200_000;

const offline = () =>
  apiError(503, 'offline', 'Máy chủ xử lý video đang tạm bận. Bạn thử lại sau ít giây nhé.');

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
  if (bodyText === null) return apiError(413, 'too_large', 'Dữ liệu gửi lên quá lớn.');

  const parsed = parseTranscribeBody(bodyText, tier);
  if ('error' in parsed) return apiError(400, 'invalid', parsed.error);

  // 1. Check 30-day D1 cache BEFORE consuming rate limits or touching VPS / Whisper Neurons
  const inputHash = await computeVideoHash(parsed.url);
  const cachedHit = await getCachedTranscript(env.DB, inputHash);
  if (cachedHit) {
    return jsonResponse({ ok: true, transcript: cachedHit, tier });
  }

  const apiKey = env.DL_API_KEY;
  const baseUrl = env.DL_BASE_URL;
  if (!apiKey || !baseUrl || !(await daemonOnline(baseUrl, apiKey)).online) {
    return offline();
  }

  if (tier === 'public') {
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const dailyCap = Math.max(20, Number.parseInt(env.VIRAL_DAILY_CAP || '', 10) || DEFAULT_VIRAL_DAILY_CAP);
    const todayKey = getVnDayKey();
    const [visitor, address, daily] = await Promise.all([
      hit(env.DB, `viral:tr:v:${parsed.visitorId}`, PUBLIC_TRANSCRIBE_VISITOR_PER_HOUR, HOUR),
      hit(env.DB, `viral:tr:ip:${await dlIpBucket(ip)}`, PUBLIC_TRANSCRIBE_IP_PER_HOUR, HOUR),
      hit(env.DB, `viral:day:${todayKey}`, dailyCap, DAY),
    ]);
    if (!visitor.allowed || !address.allowed || !daily.allowed) {
      return limited(
        'Bạn đã bóc băng nhiều video mới liên tiếp. Vui lòng đợi ít phút rồi thử lại nhé.',
        Math.max(visitor.retryAfter, address.retryAfter, daily.retryAfter),
      );
    }
  }

  const maxDurationSec = getViralMaxDuration(tier);
  const maxAudioDurationSec = Math.min(maxDurationSec, MAX_WHISPER_AUDIO_SEC);
  let upstream: Response;
  try {
    upstream = await callDaemon(
      baseUrl,
      apiKey,
      '/transcribe',
      {
        method: 'POST',
        body: JSON.stringify({
          url: parsed.url,
          maxDurationSec,
          maxAudioDurationSec,
          allowGeneric: tier === 'admin',
        }),
      },
      65_000,
    );
  } catch {
    return offline();
  }

  const daemonData = (await upstream.json().catch(() => null)) as Record<string, unknown> | null;
  if (!upstream.ok || !daemonData) {
    const msg = typeof daemonData?.error === 'string' ? daemonData.error : 'Không thể bóc băng lời thoại từ video này.';
    return apiError(upstream.status === 400 || upstream.status === 429 ? upstream.status : 502, 'transcribe_failed', msg);
  }

  const resolvedWebpage = typeof daemonData.webpageUrl === 'string' ? daemonData.webpageUrl : parsed.url;
  const resolvedId = typeof daemonData.id === 'string' ? daemonData.id : '';
  const canonical = canonicalizeMediaKey(resolvedWebpage, resolvedId);
  const canonicalHash = await computeVideoHash(resolvedWebpage, resolvedId);

  // If short-link resolved to an already-cached canonical video ID, reuse it immediately!
  if (canonicalHash !== inputHash) {
    const secondCheck = await getCachedTranscript(env.DB, canonicalHash);
    if (secondCheck) {
      return jsonResponse({ ok: true, transcript: secondCheck, tier });
    }
  }

  const detected = detectPlatform(canonical.canonicalUrl);
  const durationSec = Number(daemonData.duration) || 0;
  let transcriptText = '';
  let segments: Array<{ start: number; end: number; text: string }> = [];
  let language = typeof daemonData.language === 'string' && daemonData.language ? daemonData.language : 'vi';
  let sourceKind: 'subtitles' | 'whisper' = 'subtitles';

  if (daemonData.mode === 'subtitles' && typeof daemonData.text === 'string' && daemonData.text.trim()) {
    transcriptText = daemonData.text.trim();
    segments = Array.isArray(daemonData.segments)
      ? (daemonData.segments as Array<{ start: number; end: number; text: string }>)
      : [];
    sourceKind = 'subtitles';
  } else if (daemonData.mode === 'audio' && typeof daemonData.audioBase64 === 'string' && daemonData.audioBase64) {
    if (durationSec > MAX_WHISPER_AUDIO_SEC || daemonData.audioBase64.length > MAX_WHISPER_BASE64_CHARS) {
      return apiError(
        400,
        'audio_too_long',
        'Video không có phụ đề sẵn và thời lượng âm thanh vượt mức 10 phút cho phép của bộ nhận diện giọng nói.',
      );
    }
    if (!env.AI) {
      return apiError(503, 'ai_unavailable', 'Dịch vụ nhận diện giọng nói AI chưa được kích hoạt.');
    }
    sourceKind = 'whisper';
    try {
      const whisperRes = await env.AI.run('@cf/openai/whisper-large-v3-turbo', {
        audio: daemonData.audioBase64,
        task: 'transcribe',
        vad_filter: true,
        condition_on_previous_text: false,
      });
      const norm = normalizeWhisperOutput(whisperRes);
      transcriptText = norm.text;
      segments = norm.segments;
      language = norm.language || language;
    } catch {
      return apiError(
        502,
        'whisper_failed',
        'Không nhận diện được lời thoại rõ ràng từ âm thanh video (có thể video chỉ có nhạc nền).',
      );
    }
  }

  if (!transcriptText || transcriptText.split(/\s+/).filter(Boolean).length < 3) {
    return apiError(
      422,
      'no_speech',
      'Video này gần như không có lời thoại (chỉ có nhạc nền hoặc hiệu ứng âm thanh) nên chưa thể bóc băng kịch bản.',
    );
  }

  const saved = await saveTranscriptCache(
    env.DB,
    {
      videoHash: canonicalHash,
      platform: canonical.platform || detected.key,
      platformLabel: detected.label,
      canonicalUrl: canonical.canonicalUrl,
      title: typeof daemonData.title === 'string' ? daemonData.title : 'Video',
      uploader: typeof daemonData.uploader === 'string' ? daemonData.uploader : '',
      duration: durationSec,
      thumbnail: typeof daemonData.thumbnail === 'string' ? daemonData.thumbnail : '',
      language,
      sourceKind,
      transcriptText,
      segments,
    },
    inputHash !== canonicalHash ? inputHash : undefined,
  );

  return jsonResponse({ ok: true, transcript: saved, tier });
};
