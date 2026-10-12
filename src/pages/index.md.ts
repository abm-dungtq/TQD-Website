import { env } from 'cloudflare:workers';
import { loadSiteData } from '../lib/content';
import { markdownResponse, profileMarkdown } from '../lib/profile-markdown';

export const GET = async () => markdownResponse(profileMarkdown(await loadSiteData(env.DB)));
