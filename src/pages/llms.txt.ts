import { env } from 'cloudflare:workers';
import { loadSiteData } from '../lib/content';
import { llmsText, markdownResponse } from '../lib/profile-markdown';

export const GET = async () => markdownResponse(llmsText(await loadSiteData(env.DB)), 'text/plain');
