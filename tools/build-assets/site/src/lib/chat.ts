// Website chatbot: request validation, limits and the GoClaw call behind /api/chat.
// The GoClaw key is operator-scoped, so it only ever lives in the Worker secret GOCLAW_API_KEY.

export const MAX_MESSAGE_CHARS = 1000;
export const MAX_BODY_BYTES = 8 * 1024;
export const VISITOR_PER_HOUR = 20;
export const IP_PER_HOUR = 60; // generous: mobile carriers put many people behind one address
export const DEFAULT_DAILY_CAP = 300;
const FIRST_BYTE_TIMEOUT_MS = 20_000;
const HEALTH_TIMEOUT_MS = 4_000;
const HEALTH_TTL_MS = 60_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type ChatRequest = { message: string; visitorId: string };

/** Parses `{ message, visitorId }`; returns a Vietnamese error message when invalid. */
export function parseChatBody(text: string): ChatRequest | { error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: 'Dữ liệu gửi lên không hợp lệ.' };
  }
  const { message, visitorId } = (data ?? {}) as Record<string, unknown>;
  if (typeof visitorId !== 'string' || !UUID.test(visitorId)) return { error: 'Mã phiên trò chuyện không hợp lệ.' };
  if (typeof message !== 'string' || !message.trim()) return { error: 'Tin nhắn trống.' };
  const trimmed = message.trim();
  if (trimmed.length > MAX_MESSAGE_CHARS) return { error: `Tin nhắn tối đa ${MAX_MESSAGE_CHARS} ký tự.` };
  return { message: trimmed, visitorId };
}

/** GoClaw keeps history per user id; the `web:` namespace keeps visitors away from other channels. */
export const goclawUserId = (visitorId: string): string => `web:${visitorId}`;

/** Short, non-reversible bucket key for an IP address. */
export async function ipBucket(ip: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`tqd-chat:${ip}`));
  return [...new Uint8Array(digest).slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** True when the request comes from a page on this site. */
export function sameOrigin(request: Request, origin: string): boolean {
  const site = request.headers.get('Sec-Fetch-Site');
  return request.headers.get('Origin') === origin && (!site || site === 'same-origin');
}

export type ChatConfig = { baseUrl: string; agent: string; apiKey: string };

/** Calls GoClaw with streaming on. Resolves once headers arrive; the body keeps streaming. */
export async function callGoclaw(config: ChatConfig, chat: ChatRequest): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FIRST_BYTE_TIMEOUT_MS);
  try {
    return await fetch(`${config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'X-GoClaw-User-Id': goclawUserId(chat.visitorId),
      },
      body: JSON.stringify({ model: `goclaw:${config.agent}`, messages: [{ role: 'user', content: chat.message }], stream: true }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

let health: { at: number; online: boolean } | null = null;

/** Whether GoClaw answers its health check; cached per isolate for a minute. */
export async function goclawOnline(baseUrl: string): Promise<boolean> {
  if (health && Date.now() - health.at < HEALTH_TTL_MS) return health.online;
  let online = false;
  try {
    online = (await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) })).ok;
  } catch {
    online = false;
  }
  health = { at: Date.now(), online };
  return online;
}

/** Nightly: drop chat limit rows whose window ended more than a day ago. */
export async function cleanupChatLimits(db: D1Database): Promise<void> {
  const cutoff = Math.floor(Date.now() / 1000) - 2 * 86_400;
  await db.prepare("DELETE FROM rate_limits WHERE bucket LIKE 'chat:%' AND window_start < ?1").bind(cutoff).run();
}
