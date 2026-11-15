import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getSite, listArticles } from '../lib/content';
import { buildRssXml, READ_ONLY_CORS_HEADERS } from '../lib/feeds';

export const GET: APIRoute = async ({ request }) => {
  const origin = new URL(request.url).origin;
  const [site, articles] = await Promise.all([getSite(env.DB), listArticles(env.DB)]);
  const body = buildRssXml(site, articles, origin);
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      ...READ_ONLY_CORS_HEADERS,
    },
  });
};

export const OPTIONS: APIRoute = () =>
  new Response(null, {
    status: 204,
    headers: READ_ONLY_CORS_HEADERS,
  });
