import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { lastModifiedIso, loadSiteData } from '../lib/content';
import { markdownResponse, profileMarkdown } from '../lib/profile-markdown';

export const GET: APIRoute = async ({ request }) => {
  const [data, lastmod] = await Promise.all([loadSiteData(env.DB), lastModifiedIso(env.DB)]);
  return markdownResponse(profileMarkdown(data, new URL(request.url).origin, lastmod));
};
