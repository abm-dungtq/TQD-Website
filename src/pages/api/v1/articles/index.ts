import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { apiError, jsonResponse, requireKey } from '../../../../lib/api';

export const GET: APIRoute = async (context) => {
  const key = await requireKey(context, 'articles:write');
  if (key instanceof Response) return key;
  const status = context.url.searchParams.get('status');
  if (status !== null && status !== 'draft' && status !== 'published') {
    return apiError(400, 'invalid', 'status chỉ nhận draft hoặc published.');
  }
  const { results } = await env.DB.prepare(
    `SELECT slug, title, status, version, updated_at AS updatedAt FROM articles
     ${status ? 'WHERE status = ?1' : ''} ORDER BY updated_at DESC, id DESC LIMIT 50`,
  )
    .bind(...(status ? [status] : []))
    .all();
  return jsonResponse(results);
};
