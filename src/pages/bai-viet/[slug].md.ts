import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getArticle, getSite } from '../../lib/content';
import { articleMarkdown, markdownResponse } from '../../lib/profile-markdown';

export const GET: APIRoute = async ({ params, request }) => {
  const slug = params.slug ?? '';
  const [article, site] = await Promise.all([getArticle(env.DB, slug), getSite(env.DB)]);
  if (!article) return new Response('Not found', { status: 404 });
  return markdownResponse(articleMarkdown(article, site, new URL(request.url).origin));
};
