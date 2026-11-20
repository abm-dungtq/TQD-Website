// Google Search Console ownership file, fetched by Google as /googlec9ec92b28c893b4f.html.
// It is a route because a static `.html` asset is redirected to its extensionless URL, which Google does not
// follow. Astro drops the `.html` suffix before matching, so this file name carries none.
import type { APIRoute } from 'astro';

export const GET: APIRoute = () =>
  new Response('google-site-verification: googlec9ec92b28c893b4f.html', {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
