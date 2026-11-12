import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { lastModified, loadSiteData } from '../lib/content';
import { llmsFullText, markdownResponse } from '../lib/profile-markdown';

export const GET: APIRoute = async ({ request }) => {
  const [data, lastmod] = await Promise.all([loadSiteData(env.DB), lastModified(env.DB)]);
  return markdownResponse(llmsFullText(data, new URL(request.url).origin, lastmod));
};
