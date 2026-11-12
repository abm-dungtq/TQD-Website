import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { lastModified, loadSiteData, type SectionId } from '../lib/content';
import { markdownResponse, sectionMarkdown } from '../lib/profile-markdown';

const VALID_SECTIONS = new Set<string>(['ho-so', 'san-pham', 'thu-vien', 'video-ai', 'bai-viet', 'lien-he']);

export const GET: APIRoute = async ({ params, request }) => {
  const sectionId = params.section ?? '';
  if (!VALID_SECTIONS.has(sectionId)) return new Response('Not found', { status: 404 });
  const [data, lastmod] = await Promise.all([loadSiteData(env.DB), lastModified(env.DB)]);
  const body = sectionMarkdown(sectionId as SectionId, data, new URL(request.url).origin, lastmod);
  return body ? markdownResponse(body) : new Response('Not found', { status: 404 });
};
