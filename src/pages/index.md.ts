import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { loadSiteData } from '../lib/content';
import { markdownResponse, profileMarkdown } from '../lib/profile-markdown';

export const GET: APIRoute = async ({ request }) =>
  markdownResponse(profileMarkdown(await loadSiteData(env.DB), new URL(request.url).origin));
