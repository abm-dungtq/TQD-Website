// Index for the ⌘K palette. Only published articles and visible items; the middleware caches it per content_version.
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { type ItemKind, loadSiteData, type SectionId } from '../lib/content';

const SECTION_OF: Record<ItemKind, SectionId> = { product: 'san-pham', video: 'video-ai' };

export const GET: APIRoute = async () => {
  const { site, products, videos, articles } = await loadSiteData(env.DB);
  const sectionTitle = (id: SectionId) => site.sections.find((s) => s.id === id)?.title ?? '';
  const entries = [
    {
      title: 'Đặt lịch tư vấn & đào tạo AI Doanh nghiệp (Zalo trực tiếp)',
      url: 'https://zalo.me/trinhquangdung',
      kind: 'section',
      hint: 'zalo.me/trinhquangdung',
    },
    ...site.sections.map((s) => ({ title: s.title, url: `/${s.id}`, kind: 'section', hint: s.short, id: s.id })),
    {
      title: 'Tải Video & Xưởng Mổ Xẻ Kịch Bản Viral AI (Viết Pro)',
      url: '/tai-video',
      kind: 'product',
      hint: 'Tải MP4 H.264, MP3 320kbps, Bóc băng & Nhân bản kịch bản',
    },
    {
      title: 'Chính sách Quyền riêng tư & Dữ liệu',
      url: '/quyen-rieng-tu',
      kind: 'section',
      hint: 'Minh bạch dữ liệu, không quảng cáo, tự xóa tạm',
    },
    {
      title: 'Kho tri thức đầy đủ cho AI Agent (llms-full.txt)',
      url: '/llms-full.txt',
      kind: 'product',
      hint: 'Toàn văn hồ sơ, sản phẩm & bài viết dạng Markdown',
    },
    ...articles.map((a) => ({ title: a.title, url: `/bai-viet/${a.slug}`, kind: 'article', hint: a.summary })),
    ...[...products, ...videos].map((i) => ({
      title: i.title,
      url: `/${SECTION_OF[i.kind]}`,
      kind: i.kind,
      hint: sectionTitle(SECTION_OF[i.kind]),
      id: SECTION_OF[i.kind],
    })),
  ];
  return new Response(JSON.stringify(entries), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
