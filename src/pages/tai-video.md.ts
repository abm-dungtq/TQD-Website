// GET /tai-video.md: Markdown twin for the /tai-video multi-platform downloader & Viral Video Lab page.
import type { APIRoute } from 'astro';
import { markdownResponse, taiVideoMarkdown } from '../lib/profile-markdown';

export const GET: APIRoute = ({ url }) => {
  const origin = url.origin || 'https://tqd.me';
  return markdownResponse(taiVideoMarkdown(origin));
};
