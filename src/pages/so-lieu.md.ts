// The "Số liệu" section was removed; old links land on the home page.
export const GET = () => new Response(null, { status: 301, headers: { Location: '/index.md' } });
