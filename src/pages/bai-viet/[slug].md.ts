import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getArticle, getSite } from '../../lib/content';
import { markdownResponse } from '../../lib/profile-markdown';

export const GET: APIRoute = async ({ params, request }) => {
  const slug = params.slug ?? '';
  const article = await getArticle(env.DB, slug);
  if (!article) return new Response('Not found', { status: 404 });
  const site = await getSite(env.DB);
  const origin = new URL(request.url).origin;
  const canonical = `${origin}/bai-viet/${article.slug}`;
  const published = article.publishedAt ? article.publishedAt.slice(0, 10) : '';
  const updated = article.updatedAt ? article.updatedAt.slice(0, 10) : '';

  const metaParts = [
    `Nguồn: ${canonical}`,
    `Tác giả: ${site.person.name} (${site.person.handle})`,
    ...(published ? [`Đăng ngày: ${published}`] : []),
    ...(updated ? [`Cập nhật: ${updated}`] : []),
  ];

  const lines = [
    `# ${article.title}`,
    '',
    `> ${metaParts.join(' · ')}`,
    '',
  ];
  if (article.tags.length > 0) {
    lines.push(`Chủ đề: ${article.tags.join(', ')}`, '');
  }
  if (article.summary) {
    lines.push(`_${article.summary}_`, '');
  }
  lines.push(article.bodyMd.trim(), '');
  return markdownResponse(lines.join('\n'));
};
