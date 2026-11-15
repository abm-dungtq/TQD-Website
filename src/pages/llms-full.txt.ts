import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { lastModifiedIso, listRecentArticlesWithBody, loadSiteData } from '../lib/content';
import { llmsFullText, markdownResponse } from '../lib/profile-markdown';

export const GET: APIRoute = async ({ request }) => {
  const [data, recentArticles, lastmod] = await Promise.all([
    loadSiteData(env.DB),
    listRecentArticlesWithBody(env.DB, 12),
    lastModifiedIso(env.DB),
  ]);
  return markdownResponse(llmsFullText(data, new URL(request.url).origin, recentArticles, lastmod));
};
