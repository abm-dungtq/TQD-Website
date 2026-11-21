// Pure builders for /rss.xml (RSS 2.0) and /feed.json (JSON Feed v1.1).
import { introParagraphs, type Article, type Site } from './content';

const DEFAULT_ORIGIN = 'https://tqd.me';

export const READ_ONLY_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
};

export interface JsonFeedAuthor {
  name: string;
  url?: string;
}

export interface JsonFeedItem {
  id: string;
  url: string;
  title: string;
  summary: string;
  content_text?: string;
  image?: string;
  date_published: string;
  date_modified: string;
  tags: string[];
  authors: JsonFeedAuthor[];
  _tqd: {
    kind: 'article';
    slug: string;
    markdown_url: string;
  };
}

export interface JsonFeedDocument {
  version: 'https://jsonfeed.org/version/1.1';
  title: string;
  home_page_url: string;
  feed_url: string;
  description: string;
  language: string;
  authors: JsonFeedAuthor[];
  items: JsonFeedItem[];
}

export function normalizeOrigin(siteOrigin = DEFAULT_ORIGIN): string {
  const trimmed = (siteOrigin || DEFAULT_ORIGIN).trim().replace(/\/+$/, '');
  return trimmed || DEFAULT_ORIGIN;
}

/** Normalizes SQLite `YYYY-MM-DD HH:MM:SS`, `YYYY-MM-DD`, or ISO timestamps to full ISO 8601 UTC (`...Z`). */
export function toIsoUtc(value?: string | null): string {
  if (!value || !value.trim()) return new Date(0).toISOString();
  const trimmed = value.trim();
  let candidate = trimmed;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    candidate = `${trimmed}T00:00:00Z`;
  } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(trimmed)) {
    candidate = `${trimmed.replace(' ', 'T')}Z`;
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(trimmed)) {
    candidate = `${trimmed}Z`;
  }
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString();
}

function parseUtcDate(value?: string | null): Date {
  return new Date(toIsoUtc(value));
}

/** Escapes XML 1.0 special characters and strips disallowed control bytes. */
export function escapeXml(raw: string): string {
  return String(raw ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function imageMimeType(coverKey: string): string | undefined {
  const lower = coverKey.toLowerCase();
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.avif')) return 'image/avif';
  if (lower.endsWith('.gif')) return 'image/gif';
  return undefined;
}

function safeCoverMediaUrl(coverKey: string | undefined, origin: string): string | undefined {
  if (!coverKey) return undefined;
  const clean = coverKey.trim();
  if (!clean || clean.startsWith('/') || clean.includes('..') || clean.includes('://')) return undefined;
  if (!/^[a-zA-Z0-9/_.-]+$/.test(clean)) return undefined;
  try {
    const resolved = new URL(`/media/${clean}`, `${origin}/`);
    return resolved.pathname.startsWith('/media/') ? resolved.href : undefined;
  } catch {
    return undefined;
  }
}

function sortPublishedArticles(articles: Article[]): Article[] {
  return articles
    .filter((a) => a.status !== 'draft')
    .slice()
    .sort((a, b) => {
      const timeB = parseUtcDate(b.publishedAt || b.updatedAt).getTime();
      const timeA = parseUtcDate(a.publishedAt || a.updatedAt).getTime();
      return timeB - timeA;
    });
}

function siteMeta(site: Site, origin: string) {
  const personName = site.person?.name?.trim() || 'Trịnh Quang Dũng';
  const personHandle = site.person?.handle?.trim() || 'DũngTQ';
  const role = site.person?.role?.trim() || 'Ứng dụng AI vào vận hành doanh nghiệp';
  const firstIntro = introParagraphs(site.person?.intro ?? '')[0] ?? '';
  const description = firstIntro ? `${role}. ${firstIntro}` : role;
  const email = site.person?.email?.trim() || 'dungtq.ceo@gmail.com';
  const authorLabel = `${personName} (${personHandle})`;
  const authorUrl = `${origin}/ho-so`;
  return { personName, personHandle, description, email, authorLabel, authorUrl };
}

export function buildRssXml(site: Site, articles: Article[], siteOrigin = DEFAULT_ORIGIN): string {
  const origin = normalizeOrigin(siteOrigin);
  const meta = siteMeta(site, origin);
  const items = sortPublishedArticles(articles);

  const latestMs = items.reduce((max, a) => {
    const t = parseUtcDate(a.updatedAt || a.publishedAt).getTime();
    return t > max ? t : max;
  }, 0);
  const lastBuildDate = (latestMs > 0 ? new Date(latestMs) : new Date()).toUTCString();

  const itemXml = items.map((a) => {
    const slugEncoded = encodeURIComponent(a.slug);
    const articleUrl = `${origin}/bai-viet/${slugEncoded}`;
    const mdUrl = `${origin}/bai-viet/${slugEncoded}.md`;
    const pubDate = parseUtcDate(a.publishedAt || a.updatedAt).toUTCString();
    const summaryText = (a.summary || a.title).trim();
    const descriptionText = `${summaryText} - Đọc bản Markdown cho AI Agent: ${mdUrl}`;
    const categories = (a.tags ?? [])
      .filter((t) => typeof t === 'string' && t.trim().length > 0)
      .map((t) => `      <category>${escapeXml(t.trim())}</category>`)
      .join('\n');
    const coverUrl = safeCoverMediaUrl(a.coverKey, origin);
    const coverMime = a.coverKey ? imageMimeType(a.coverKey) : undefined;
    const enclosure =
      coverUrl && coverMime
        ? `\n      <enclosure url="${escapeXml(coverUrl)}" length="0" type="${escapeXml(coverMime)}" />`
        : '';

    return [
      '    <item>',
      `      <title>${escapeXml(a.title)}</title>`,
      `      <link>${escapeXml(articleUrl)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(articleUrl)}</guid>`,
      `      <pubDate>${escapeXml(pubDate)}</pubDate>`,
      `      <author>${escapeXml(`${meta.email} (${meta.personName})`)}</author>`,
      `      <description>${escapeXml(descriptionText)}</description>${categories ? `\n${categories}` : ''}${enclosure}`,
      '    </item>',
    ].join('\n');
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${escapeXml(`${meta.authorLabel} - Bài viết & Tri thức AI`)}</title>`,
    `    <link>${escapeXml(`${origin}/`)}</link>`,
    `    <description>${escapeXml(meta.description)}</description>`,
    '    <language>vi</language>',
    `    <lastBuildDate>${escapeXml(lastBuildDate)}</lastBuildDate>`,
    `    <atom:link href="${escapeXml(`${origin}/rss.xml`)}" rel="self" type="application/rss+xml" />`,
    ...itemXml,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
}

export function buildJsonFeed(site: Site, articles: Article[], siteOrigin = DEFAULT_ORIGIN): JsonFeedDocument {
  const origin = normalizeOrigin(siteOrigin);
  const meta = siteMeta(site, origin);
  const author: JsonFeedAuthor = { name: meta.authorLabel, url: meta.authorUrl };
  const items: JsonFeedItem[] = sortPublishedArticles(articles).map((a) => {
    const slugEncoded = encodeURIComponent(a.slug);
    const articleUrl = `${origin}/bai-viet/${slugEncoded}`;
    const mdUrl = `${origin}/bai-viet/${slugEncoded}.md`;
    const imageUrl = safeCoverMediaUrl(a.coverKey, origin);
    const bodyText = a.bodyMd?.trim();

    return {
      id: articleUrl,
      url: articleUrl,
      title: a.title,
      summary: (a.summary || a.title).trim(),
      ...(bodyText ? { content_text: bodyText } : {}),
      ...(imageUrl ? { image: imageUrl } : {}),
      date_published: toIsoUtc(a.publishedAt || a.updatedAt),
      date_modified: toIsoUtc(a.updatedAt || a.publishedAt),
      tags: Array.isArray(a.tags) ? a.tags.filter((t) => typeof t === 'string' && t.trim().length > 0) : [],
      authors: [author],
      _tqd: {
        kind: 'article',
        slug: a.slug,
        markdown_url: mdUrl,
      },
    };
  });

  return {
    version: 'https://jsonfeed.org/version/1.1',
    title: `${meta.authorLabel} - tqd.me`,
    home_page_url: `${origin}/`,
    feed_url: `${origin}/feed.json`,
    description: meta.description,
    language: 'vi-VN',
    authors: [author],
    items,
  };
}
