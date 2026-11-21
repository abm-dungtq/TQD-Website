// GET /xray/[id].md: Markdown twin for Viral X-Ray & Viết Pro report share pages.
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { SITE_PERSON } from '../../lib/site-profile';
import { getViralShare, VIRAL_FORMATS } from '../../lib/viral';

/** Strip external markdown links on unverified public shares so agent crawlers don't follow untrusted links. */
function stripExternalLinksInMd(md: string): string {
  return md.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi, (_m, label: string) => label);
}

interface Frontmatter {
  source: string;
  title: string;
  author?: string;
  updated?: string;
  summary?: string;
  tags?: string[];
  curated?: boolean;
  robots?: string;
}

function renderFrontmatter(meta: Frontmatter): string {
  const lines = ['---', `source: ${JSON.stringify(meta.source)}`, `title: ${JSON.stringify(meta.title)}`];
  if (meta.author) lines.push(`author: ${JSON.stringify(meta.author)}`);
  if (meta.updated) lines.push(`updated: ${JSON.stringify(meta.updated)}`);
  if (meta.summary) lines.push(`summary: ${JSON.stringify(meta.summary)}`);
  if (meta.tags && meta.tags.length > 0) lines.push(`tags: [${meta.tags.map((tag) => JSON.stringify(tag)).join(', ')}]`);
  if (typeof meta.curated === 'boolean') lines.push(`curated: ${meta.curated}`);
  if (meta.robots) lines.push(`robots: ${JSON.stringify(meta.robots)}`);
  lines.push('---');
  return lines.join('\n');
}

const markdownResponse = (body: string): Response =>
  new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'X-Robots-Tag': 'noindex, follow',
      'Cache-Control': 'public, max-age=300',
    },
  });

export const GET: APIRoute = async ({ params, request }) => {
  const rawId = params.id ?? '';
  const share = await getViralShare(env.DB, rawId);
  if (!share) return new Response('Not found', { status: 404 });

  const origin = new URL(request.url).origin;
  const isCurated = share.shareId.startsWith('c-');
  const formatSpec = VIRAL_FORMATS.find((f) => f.key === share.formatKey);
  const formatLabel = formatSpec ? formatSpec.label : 'X-Quang Công Thức Viral';
  const updatedIso = share.createdAt ? new Date(share.createdAt * 1000).toISOString() : undefined;

  const safeXray = isCurated ? share.xrayMarkdown : stripExternalLinksInMd(share.xrayMarkdown);
  const safeScript = isCurated ? share.scriptMarkdown : stripExternalLinksInMd(share.scriptMarkdown);
  const reportTitle = `Báo cáo X-Quang Viral: ${share.title}`;
  const frontmatter = renderFrontmatter({
    source: `${origin}/xray/${share.shareId}`,
    title: reportTitle,
    author: `${SITE_PERSON.name} (${SITE_PERSON.handle})`,
    updated: updatedIso,
    summary: `Phân tích X-Quang Viral (${formatLabel}) · Điểm tự nhiên Viết Pro: ${share.vietProScore}/100`,
    tags: [formatLabel, ...(share.platformLabel ? [share.platformLabel] : []), ...(share.industry ? [share.industry] : [])],
    curated: isCurated,
    robots: isCurated ? 'index, follow' : 'noindex, nofollow',
  });

  const lines = [
    frontmatter,
    '',
    `# ${reportTitle}`,
    '',
    `- **Điểm tự nhiên Viết Pro**: ${share.vietProScore}/100`,
    `- **Định dạng chuyển thể**: ${formatLabel}`,
    ...(share.platformLabel ? [`- **Nền tảng gốc**: ${share.platformLabel}`] : []),
    ...(share.uploader ? [`- **Kênh gốc**: ${share.uploader}`] : []),
    ...(share.industry ? [`- **Ngành chuyển thể**: ${share.industry}`] : []),
  ];

  if (safeXray.trim()) lines.push('', '## Giải phẫu X-Quang Công Thức Viral', '', safeXray.trim());
  if (safeScript.trim()) lines.push('', '## Bản Kịch Bản & Nội Dung Mới (Chuẩn Viết Pro)', '', safeScript.trim());
  lines.push('');
  return markdownResponse(lines.join('\n'));
};
