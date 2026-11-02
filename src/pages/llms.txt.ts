import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { loadSiteData } from '../lib/content';
import { llmsText, markdownResponse } from '../lib/profile-markdown';

export const GET: APIRoute = async ({ request }) =>
  markdownResponse(llmsText(await loadSiteData(env.DB), new URL(request.url).origin), 'text/plain');
