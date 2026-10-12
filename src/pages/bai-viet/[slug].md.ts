import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getArticle } from '../../lib/content';
import { markdownResponse } from '../../lib/profile-markdown';

export const GET: APIRoute = async ({ params }) => {
  const article = await getArticle(env.DB, params.slug ?? '');
  if (!article) return new Response('Not found', { status: 404 });
  return markdownResponse(`# ${article.title}\n\n${article.summary}\n\n${article.bodyMd}\n`);
};
