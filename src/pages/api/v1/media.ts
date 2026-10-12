import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { apiError, jsonResponse, requireKey } from '../../../lib/api';
import { deleteMedia, MediaError, storeMedia } from '../../../lib/media';

const ERROR_CODE: Record<number, string> = { 400: 'invalid', 411: 'length_required', 413: 'too_large', 415: 'unsupported_type' };

export const POST: APIRoute = async (context) => {
  const key = await requireKey(context, 'media:write');
  if (key instanceof Response) return key;
  const { request, url } = context;
  const alt = url.searchParams.get('alt') ?? '';
  try {
    const stored = await storeMedia(
      env,
      request.body,
      Number(request.headers.get('Content-Length')),
      url.searchParams.get('filename') ?? 'file',
      alt,
      `agent:${key.name}`,
    );
    return jsonResponse(
      { ...stored, url: `${url.origin}${stored.url}`, markdown: `![${alt.replace(/[[\]]/g, '')}](${stored.url})` },
      201,
    );
  } catch (e) {
    if (e instanceof MediaError) return apiError(e.status, ERROR_CODE[e.status] ?? 'invalid', e.message);
    throw e;
  }
};

export const DELETE: APIRoute = async (context) => {
  const key = await requireKey(context, 'media:write');
  if (key instanceof Response) return key;
  if (!(await deleteMedia(env, context.url.searchParams.get('key') ?? ''))) {
    return apiError(404, 'not_found', 'Không có tệp này.');
  }
  return new Response(null, { status: 204 });
};
