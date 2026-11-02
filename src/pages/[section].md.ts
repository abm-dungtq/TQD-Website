import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { loadSiteData, type SectionId } from '../lib/content';
import { markdownResponse, sectionMarkdown } from '../lib/profile-markdown';

export const GET: APIRoute = async ({ params, request }) => {
  const body = sectionMarkdown(params.section as SectionId, await loadSiteData(env.DB), new URL(request.url).origin);
  return body ? markdownResponse(body) : new Response('Not found', { status: 404 });
};
