import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { deleteMedia, MediaError, storeMedia } from '../../../lib/media';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

export const POST: APIRoute = async ({ request, url, locals }) => {
  if (!locals.admin) return new Response('Unauthorized', { status: 401 });
  try {
    const stored = await storeMedia(
      env,
      request.body,
      Number(request.headers.get('Content-Length')),
      url.searchParams.get('filename') ?? 'file',
      url.searchParams.get('alt') ?? '',
      'admin',
    );
    return json(stored, 201);
  } catch (e) {
    if (e instanceof MediaError) return json({ error: e.message }, e.status);
    throw e;
  }
};

export const DELETE: APIRoute = async ({ url, locals }) => {
  if (!locals.admin) return new Response('Unauthorized', { status: 401 });
  const deleted = await deleteMedia(env, url.searchParams.get('key') ?? '');
  return deleted ? new Response(null, { status: 204 }) : json({ error: 'Không tìm thấy.' }, 404);
};
