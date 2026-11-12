// GET /xray/[id].md: Markdown twin for Viral X-Ray & Viết Pro report share pages.
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getSite } from '../../lib/content';
import { markdownResponse } from '../../lib/profile-markdown';
import { getViralShare, VIRAL_FORMATS } from '../../lib/viral';

/** Strip external markdown links on unverified public shares so agent crawlers don't follow untrusted links. */
function stripExternalLinksInMd(md: string): string {
  return md.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi, (_m, label: string) => label);
}

export const GET: APIRoute = async ({ params, request }) => {
  const rawId = params.id ?? '';
  const share = await getViralShare(env.DB, rawId);
  if (!share) return new Response('Not found', { status: 404 });

  const site = await getSite(env.DB);
  const origin = new URL(request.url).origin;
  const isCurated = share.shareId.startsWith('c-');
  const formatSpec = VIRAL_FORMATS.find((f) => f.key === share.formatKey);
  const formatLabel = formatSpec ? formatSpec.label : 'X-Quang Công Thức Viral';
  const createdDate = share.createdAt
    ? new Date(share.createdAt * 1000).toISOString().slice(0, 10)
    : '';

  const safeXray = isCurated ? share.xrayMarkdown : stripExternalLinksInMd(share.xrayMarkdown);
  const safeScript = isCurated ? share.scriptMarkdown : stripExternalLinksInMd(share.scriptMarkdown);

  const lines = [
    `# Báo cáo X-Quang Viral: ${share.title}`,
    '',
    `> Nguồn báo cáo: ${origin}/xray/${share.shareId} · Công cụ: ${site.person.name} (${site.person.handle})${createdDate ? ` · Ngày tạo: ${createdDate}` : ''} · Điểm tự nhiên Viết Pro: ${share.vietProScore}/100`,
    '',
    `- **Định dạng chuyển thể**: ${formatLabel}`,
    ...(share.platformLabel ? [`- **Nền tảng gốc**: ${share.platformLabel}`] : []),
    ...(share.uploader ? [`- **Kênh gốc**: ${share.uploader}`] : []),
    ...(share.industry ? [`- **Ngành chuyển thể**: ${share.industry}`] : []),
  ];

  if (safeXray.trim()) {
    lines.push('', '## Giải phẫu X-Quang Công Thức Viral', '', safeXray.trim());
  }
  if (safeScript.trim()) {
    lines.push('', '## Bản Kịch Bản & Nội Dung Mới (Chuẩn Viết Pro)', '', safeScript.trim());
  }
  lines.push('');
  return markdownResponse(lines.join('\n'));
};
