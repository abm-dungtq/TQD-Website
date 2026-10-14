// The "Đào tạo & sự kiện" section became the gallery; old links land there.
export const GET = () => new Response(null, { status: 301, headers: { Location: '/thu-vien.md' } });
