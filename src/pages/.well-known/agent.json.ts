import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { buildAgentCard } from '../../lib/agent-card';
import { loadSiteData } from '../../lib/content';
import { READ_ONLY_CORS_HEADERS } from '../../lib/feeds';

export const GET: APIRoute = async ({ request }) => {
  const origin = new URL(request.url).origin;
  const data = await loadSiteData(env.DB);
  const card = buildAgentCard(data, origin);
  return new Response(JSON.stringify(card, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Robots-Tag': 'noindex',
      ...READ_ONLY_CORS_HEADERS,
    },
  });
};

export const OPTIONS: APIRoute = () =>
  new Response(null, {
    status: 204,
    headers: READ_ONLY_CORS_HEADERS,
  });
