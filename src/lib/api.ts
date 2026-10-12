// Shared plumbing for /api/v1: bearer-key auth, scopes, per-key rate limit, JSON errors.
// Policy (scopes, publish rules) lives here and in the endpoints; the write helpers stay permission-free.
import type { APIContext } from 'astro';
import { env } from 'cloudflare:workers';
import { type ApiKey, authenticate, type Scope } from './api-key';
import { hit } from './rate-limit';

export const REQUESTS_PER_MINUTE = 60;

export const jsonResponse = (data: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(data === null ? null : JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });

export const apiError = (status: number, code: string, message: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}): Response =>
  jsonResponse({ error: code, message, ...extra }, status, headers);

/** Resolves the request's API key, or the error response to send. Cookies are never consulted. */
export async function requireKey(context: APIContext, scope?: Scope): Promise<ApiKey | Response> {
  const key = await authenticate(env.DB, context.request.headers.get('Authorization'));
  if (!key) return apiError(401, 'unauthorized', 'API key thiếu, sai hoặc đã bị thu hồi.');
  const limit = await hit(env.DB, `api:${key.id}`, REQUESTS_PER_MINUTE, 60);
  if (!limit.allowed) {
    return apiError(429, 'rate_limited', `Tối đa ${REQUESTS_PER_MINUTE} request mỗi phút.`, {}, { 'Retry-After': String(Math.max(1, limit.retryAfter)) });
  }
  if (scope && !key.scopes.includes(scope)) return apiError(403, 'forbidden', `Key thiếu quyền ${scope}.`);
  context.locals.cfContext.waitUntil(
    env.DB.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?1 AND (last_used_at IS NULL OR last_used_at < datetime('now', '-60 seconds'))").bind(key.id).run(),
  );
  return key;
}

/** Reads at most `max` bytes of body, whether or not Content-Length was sent; `null` when larger. */
export async function readBodyCapped(request: Request, max: number): Promise<string | null> {
  if (Number(request.headers.get('Content-Length') ?? 0) > max) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  chunks.reduce((at, chunk) => (bytes.set(chunk, at), at + chunk.byteLength), 0);
  return new TextDecoder().decode(bytes);
}

/** Version from an `If-Match` header such as `"v3"` or `W/"v3"`. */
export const parseIfMatch = (header: string): string => header.trim().replace(/^W\//, '').replace(/"/g, '');

export const etag = (version: number): string => `"v${version}"`;
