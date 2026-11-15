// Markdown twin redirect /video.md -> /video-ai.md.
export const GET = () => new Response(null, { status: 301, headers: { Location: '/video-ai.md' } });
