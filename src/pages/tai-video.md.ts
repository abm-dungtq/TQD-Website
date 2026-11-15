// GET /tai-video.md: Markdown twin for the /tai-video multi-platform downloader & Viral Video Lab page.
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { lastModifiedIso } from '../lib/content';
import { markdownResponse, taiVideoMarkdown } from '../lib/profile-markdown';

export const GET: APIRoute = async ({ url }) => {
  const origin = url.origin || 'https://tqd.me';
  const lastmod = await lastModifiedIso(env.DB);
  return markdownResponse(taiVideoMarkdown(origin, lastmod));
};
