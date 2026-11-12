// GET /quyen-rieng-tu.md: Markdown twin for the Privacy Policy page.
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getSite } from '../lib/content';
import { markdownResponse, privacyMarkdown } from '../lib/profile-markdown';

export const GET: APIRoute = async ({ request }) => {
  const site = await getSite(env.DB);
  const origin = new URL(request.url).origin;
  return markdownResponse(privacyMarkdown(origin, site.person.email));
};
