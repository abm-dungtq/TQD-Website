// Alias for /video -> /video-ai so external links and users land cleanly.
export const GET = () => new Response(null, { status: 301, headers: { Location: '/video-ai' } });
