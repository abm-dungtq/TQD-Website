// GET /shop.md: Markdown twin for the /shop Google AI Ultra & Veo configurator page.
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { lastModifiedIso } from '../lib/content';
import { markdownResponse, shopMarkdown } from '../lib/profile-markdown';

export const GET: APIRoute = async ({ url }) => {
  const origin = url.origin || 'https://tqd.me';
  const lastmod = await lastModifiedIso(env.DB);
  return markdownResponse(shopMarkdown(origin, lastmod));
};
