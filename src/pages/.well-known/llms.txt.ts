import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { loadSiteData } from '../../lib/content';
import { llmsText } from '../../lib/profile-markdown';

export const GET: APIRoute = async ({ request }) => {
  const origin = new URL(request.url).origin;
  const data = await loadSiteData(env.DB);
  return new Response(llmsText(data, origin), {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'X-Robots-Tag': 'noindex',
      Link: `<${origin}/llms.txt>; rel="canonical"`,
    },
  });
};
