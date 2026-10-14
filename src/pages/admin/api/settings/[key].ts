import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

const KEYS = new Set(['person', 'stats', 'links', 'topics', 'sections', 'gallery']);

export const GET: APIRoute = async ({ params, locals }) => {
  if (!locals.admin) return new Response('Unauthorized', { status: 401 });
  if (!params.key || !KEYS.has(params.key)) return new Response('Not found', { status: 404 });
  const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?1').bind(params.key).first<{ value: string }>();
  if (!row) return new Response('Not found', { status: 404 });
  return new Response(row.value, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
