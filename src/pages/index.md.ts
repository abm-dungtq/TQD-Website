import { markdownResponse, profileMarkdown } from '../lib/profile-markdown';

export const GET = () => markdownResponse(profileMarkdown());
