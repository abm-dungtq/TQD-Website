// Public read-only catalog builder for /catalog.json (keeps /search.json contract intact for ⌘K).
import type { Link, SiteData } from './content';
import { normalizeOrigin, toIsoUtc } from './feeds';

export type CatalogItemType = 'article' | 'product' | 'video' | 'tool' | 'showcase';

export interface CuratedShareSummary {
  shareId: string;
  title: string;
  platformLabel: string;
  formatKey: string;
  industry: string;
  vietProScore: number;
  createdAt: number;
}

export interface CatalogLink {
  label: string;
  url: string;
}

export interface CatalogItem {
  id: string;
  type: CatalogItemType;
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  publishedAt: string | null;
  updatedAt: string | null;
  htmlUrl: string;
  markdownUrl: string | null;
  imageUrl?: string;
  links?: CatalogLink[];
}

export interface PublicCatalog {
  schemaVersion: '1.0';
  generatedAt: string;
  siteOrigin: string;
  contentVersion?: number;
  owner: {
    name: string;
    handle: string;
    role: string;
    profileUrl: string;
    zaloUrl: string;
    email: string;
  };
  sections: Array<{
    id: string;
    title: string;
    short: string;
    htmlUrl: string;
    markdownUrl: string;
  }>;
  endpoints: {
    llmsTxt: string;
    wellKnownLlmsTxt: string;
    llmsFullTxt: string;
    agentCard: string;
    catalogJson: string;
    rssXml: string;
    feedJson: string;
    sitemapXml: string;
    searchJson: string;
  };
  items: CatalogItem[];
}

export interface BuildPublicCatalogInput {
  siteOrigin?: string;
  data: SiteData;
  curatedShares?: CuratedShareSummary[];
  contentVersion?: number;
  generatedAt?: string;
}

/** Allows only `http:`, `https:`, or clean site-relative `/` paths (rejects `javascript:`, `data:`, `//`). */
export function sanitizeCatalogUrl(rawHref: string, siteOrigin = 'https://tqd.me'): string | null {
  if (typeof rawHref !== 'string') return null;
  const trimmed = rawHref.trim();
  if (!trimmed || /[\u0000-\u001F\u007F\\]/.test(trimmed)) return null;

  const origin = normalizeOrigin(siteOrigin);
  if (trimmed.startsWith('/')) {
    if (trimmed.startsWith('//')) return null;
    try {
      const originUrl = new URL(`${origin}/`);
      const resolved = new URL(trimmed, originUrl);
      if (resolved.origin !== originUrl.origin) return null;
      return resolved.href;
    } catch {
      return null;
    }
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
}

export function sanitizeCatalogLinks(links: Link[] | undefined, siteOrigin: string): CatalogLink[] {
  if (!Array.isArray(links)) return [];
  const clean: CatalogLink[] = [];
  for (const link of links) {
    if (!link || typeof link.href !== 'string') continue;
    const url = sanitizeCatalogUrl(link.href, siteOrigin);
    if (!url) continue;
    const label = typeof link.label === 'string' && link.label.trim() ? link.label.trim() : url;
    clean.push({ label, url });
  }
  return clean;
}

function safeCoverUrl(coverKey: string | undefined, origin: string): string | undefined {
  if (!coverKey) return undefined;
  const clean = coverKey.trim();
  if (!clean || clean.startsWith('/') || clean.includes('..') || clean.includes('://')) return undefined;
  if (!/^[a-zA-Z0-9/_.-]+$/.test(clean)) return undefined;
  return sanitizeCatalogUrl(`/media/${clean}`, origin) ?? undefined;
}

function parseItemDateToIso(dateLike?: string): string | null {
  if (!dateLike || !dateLike.trim()) return null;
  const trimmed = dateLike.trim();
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (dmy) {
    const iso = `${dmy[3]}-${dmy[2]}-${dmy[1]}T00:00:00Z`;
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const iso = toIsoUtc(trimmed);
    return iso === new Date(0).toISOString() ? null : iso;
  }
  return null;
}

export function buildPublicCatalog({
  siteOrigin = 'https://tqd.me',
  data,
  curatedShares = [],
  contentVersion,
  generatedAt,
}: BuildPublicCatalogInput): PublicCatalog {
  const origin = normalizeOrigin(siteOrigin);
  const person = data.site.person;
  const personName = person?.name?.trim() || 'Trịnh Quang Dũng';
  const personHandle = person?.handle?.trim() || 'DũngTQ';
  const zaloUrl = sanitizeCatalogUrl(person?.zalo || 'https://zalo.me/trinhquangdung', origin) ?? 'https://zalo.me/trinhquangdung';
  const email = person?.email?.trim() || 'dungtq.ceo@gmail.com';

  const sections = (data.site.sections ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    short: s.short,
    htmlUrl: `${origin}/${s.id}`,
    markdownUrl: `${origin}/${s.id}.md`,
  }));

  const articleItems: CatalogItem[] = (data.articles ?? [])
    .filter((a) => a.status !== 'draft')
    .map((a) => {
      const slugEncoded = encodeURIComponent(a.slug);
      const imageUrl = safeCoverUrl(a.coverKey, origin);
      return {
        id: `article:${a.slug}`,
        type: 'article',
        slug: a.slug,
        title: a.title,
        summary: (a.summary || a.title).trim(),
        tags: Array.isArray(a.tags) ? a.tags : [],
        publishedAt: a.publishedAt ? toIsoUtc(a.publishedAt) : null,
        updatedAt: a.updatedAt ? toIsoUtc(a.updatedAt) : null,
        htmlUrl: `${origin}/bai-viet/${slugEncoded}`,
        markdownUrl: `${origin}/bai-viet/${slugEncoded}.md`,
        ...(imageUrl ? { imageUrl } : {}),
      };
    });

  const productItems: CatalogItem[] = (data.products ?? [])
    .filter((p) => p.visible !== false)
    .map((p) => {
      const imageUrl = safeCoverUrl(p.coverKey, origin);
      const links = sanitizeCatalogLinks(p.links, origin);
      return {
        id: `product:${p.id}`,
        type: 'product',
        slug: `product-${p.id}`,
        title: p.title,
        summary: p.summary,
        tags: Array.isArray(p.tags) ? p.tags : [],
        publishedAt: parseItemDateToIso(p.date),
        updatedAt: null,
        htmlUrl: `${origin}/san-pham`,
        markdownUrl: `${origin}/san-pham.md`,
        ...(imageUrl ? { imageUrl } : {}),
        ...(links.length > 0 ? { links } : {}),
      };
    });

  const taiVideoTool: CatalogItem = {
    id: 'tool:tai-video',
    type: 'tool',
    slug: 'tai-video',
    title: 'Tải Video Đa Nền Tảng & Xưởng Mổ Xẻ Kịch Bản Viral AI',
    summary:
      'Công cụ tải video MP4 chuẩn H.264, tách nhạc MP3 320kbps, bóc băng lời thoại AI (Transcript/SRT) và viết lại kịch bản đa kênh chuẩn chống văn mẫu Viết Pro.',
    tags: ['Tải Video', 'Viral Video Lab', 'Viết Pro', 'MP4', 'MP3'],
    publishedAt: null,
    updatedAt: null,
    htmlUrl: `${origin}/tai-video`,
    markdownUrl: `${origin}/tai-video.md`,
    imageUrl: `${origin}/og/tai-video.png`,
    links: [
      { label: 'Mở công cụ', url: `${origin}/tai-video` },
      { label: 'Đặc tả Markdown', url: `${origin}/tai-video.md` },
    ],
  };

  const videoItems: CatalogItem[] = (data.videos ?? [])
    .filter((v) => v.visible !== false)
    .map((v) => {
      const extraLinks: Link[] = [...(v.links ?? [])];
      if (v.tiktokId && /^[0-9]+$/.test(v.tiktokId.trim())) {
        extraLinks.push({ label: 'TikTok', href: `https://www.tiktok.com/player/v1/${v.tiktokId.trim()}` });
      }
      const links = sanitizeCatalogLinks(extraLinks, origin);
      const imageUrl = safeCoverUrl(v.coverKey, origin);
      return {
        id: `video:${v.id}`,
        type: 'video',
        slug: `video-${v.id}`,
        title: v.title,
        summary: v.summary,
        tags: Array.isArray(v.tags) ? v.tags : [],
        publishedAt: parseItemDateToIso(v.date),
        updatedAt: null,
        htmlUrl: `${origin}/video-ai`,
        markdownUrl: `${origin}/video-ai.md`,
        ...(imageUrl ? { imageUrl } : {}),
        ...(links.length > 0 ? { links } : {}),
      };
    });

  // Security & policy gate: only admin-curated `c-*` shares are ever published to /catalog.json.
  const showcaseItems: CatalogItem[] = curatedShares
    .filter((sh) => typeof sh.shareId === 'string' && sh.shareId.startsWith('c-'))
    .map((sh) => {
      const createdIso = sh.createdAt > 0 ? new Date(sh.createdAt * 1000).toISOString() : null;
      const shareEncoded = encodeURIComponent(sh.shareId);
      const summary = sh.industry
        ? `Báo cáo X-Quang Viral (${sh.platformLabel || 'Video'}) chuyển thể ngành ${sh.industry} - Viết Pro ${sh.vietProScore}/100.`
        : `Báo cáo X-Quang công thức Viral (${sh.platformLabel || 'Video'}) - Viết Pro ${sh.vietProScore}/100.`;
      const tags = [sh.platformLabel, sh.formatKey, sh.industry]
        .map((t) => (typeof t === 'string' ? t.trim() : ''))
        .filter(Boolean);
      return {
        id: `showcase:${sh.shareId}`,
        type: 'showcase',
        slug: sh.shareId,
        title: sh.title,
        summary,
        tags,
        publishedAt: createdIso,
        updatedAt: createdIso,
        htmlUrl: `${origin}/xray/${shareEncoded}`,
        markdownUrl: `${origin}/xray/${shareEncoded}.md`,
      };
    });

  return {
    schemaVersion: '1.0',
    generatedAt: generatedAt ? toIsoUtc(generatedAt) : new Date().toISOString(),
    siteOrigin: origin,
    ...(contentVersion !== undefined ? { contentVersion } : {}),
    owner: {
      name: personName,
      handle: personHandle,
      role: person?.role?.trim() || '',
      profileUrl: `${origin}/ho-so`,
      zaloUrl,
      email,
    },
    sections,
    endpoints: {
      llmsTxt: `${origin}/llms.txt`,
      wellKnownLlmsTxt: `${origin}/.well-known/llms.txt`,
      llmsFullTxt: `${origin}/llms-full.txt`,
      agentCard: `${origin}/.well-known/agent.json`,
      catalogJson: `${origin}/catalog.json`,
      rssXml: `${origin}/rss.xml`,
      feedJson: `${origin}/feed.json`,
      sitemapXml: `${origin}/sitemap.xml`,
      searchJson: `${origin}/search.json`,
    },
    items: [...articleItems, ...productItems, taiVideoTool, ...videoItems, ...showcaseItems],
  };
}
