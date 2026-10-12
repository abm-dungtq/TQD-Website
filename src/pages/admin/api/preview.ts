import type { APIRoute } from 'astro';
import { renderMarkdown } from '../../../lib/markdown';

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.admin) return new Response('Unauthorized', { status: 401 });
  const { bodyMd } = (await request.json().catch(() => ({}))) as { bodyMd?: unknown };
  const html = await renderMarkdown(typeof bodyMd === 'string' ? bodyMd.slice(0, 100_000) : '');
  return new Response(JSON.stringify({ html }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
