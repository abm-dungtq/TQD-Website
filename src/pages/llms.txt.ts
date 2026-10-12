import { llmsText, markdownResponse } from '../lib/profile-markdown';

export const GET = () => markdownResponse(llmsText(), 'text/plain');
