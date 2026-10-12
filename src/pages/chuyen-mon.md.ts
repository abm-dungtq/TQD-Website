// The old "Chuyên môn" section became "Bài viết".
export const GET = () => new Response(null, { status: 301, headers: { Location: '/bai-viet.md' } });
