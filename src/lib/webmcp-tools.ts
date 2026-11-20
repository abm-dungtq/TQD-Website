import { fold, matches } from './search-text';

export const WEBMCP_MAX_OUTPUT_CHARS = 1500;

export const ALLOWED_SECTIONS = [
  'ho-so',
  'san-pham',
  'thu-vien',
  'video-ai',
  'bai-viet',
  'lien-he',
] as const;

export type AllowedSectionId = (typeof ALLOWED_SECTIONS)[number];

export const ALLOWED_TAI_VIDEO_PRESETS = ['best', '720', 'audio', 'pick'] as const;

export type AllowedTaiVideoPreset = (typeof ALLOWED_TAI_VIDEO_PRESETS)[number];

const TOP_LEVEL_MARKDOWN_PAGES = new Set([
  'ho-so',
  'san-pham',
  'thu-vien',
  'video-ai',
  'bai-viet',
  'lien-he',
  'shop',
  'tai-video',
  'quyen-rieng-tu',
]);

const CONTROL_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
const DISALLOWED_RAW_RE = /[\u0000-\u001F\u007F\\?#]/;
const BLOG_MARKDOWN_RE = /^\/bai-viet\/([a-z0-9-]+)(?:\.md)?$/;
const XRAY_MARKDOWN_RE = /^\/xray\/(c-[a-f0-9]{12,24})(?:\.md)?$/;

export interface SearchEntry {
  kind: 'section' | 'article' | 'product' | 'video';
  title: string;
  url: string;
  hint?: string;
}

export interface CatalogItem {
  name?: string;
  title?: string;
  slug?: string;
  url?: string;
  summary?: string;
  description?: string;
  category?: string;
}

export interface SlicedMarkdown {
  text: string;
  offset: number;
  nextOffset: number | null;
  totalLength: number;
}

/** Strips unsafe control/bidi characters and bounds tool text length. */
export function sanitizeToolText(raw: string, maxChars = WEBMCP_MAX_OUTPUT_CHARS): string {
  const limit = Number.isFinite(maxChars) && maxChars > 0 ? Math.floor(maxChars) : WEBMCP_MAX_OUTPUT_CHARS;
  const cleaned = String(raw ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_CHARS_RE, '')
    .trim();

  if (cleaned.length <= limit) return cleaned;
  if (limit === 1) return cleaned.slice(0, 1);
  return `${cleaned.slice(0, limit - 1).trimEnd()}…`;
}

function hasForbiddenPathTokens(value: string): boolean {
  const lower = value.toLowerCase();
  return (
    DISALLOWED_RAW_RE.test(value) ||
    lower.includes('://') ||
    lower.includes('//') ||
    lower.includes('..') ||
    lower === '/admin' ||
    lower.startsWith('/admin/') ||
    lower === '/api' ||
    lower.startsWith('/api/')
  );
}

/**
 * Validates and normalizes an internal Markdown twin path.
 * Allows /, /index.md, top-level sections + utility pages, /bai-viet/[slug].md,
 * and /xray/c-[hex].md share exports; rejects traversal, cross-origin, and private routes.
 */
export function resolveAllowedMarkdownPath(rawPath: string): string | null {
  if (typeof rawPath !== 'string') return null;
  const trimmed = rawPath.trim();
  if (!trimmed || hasForbiddenPathTokens(trimmed)) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    return null;
  }

  if (hasForbiddenPathTokens(decoded)) return null;

  const prefixed = decoded.startsWith('/') ? decoded : `/${decoded}`;
  const normalized = prefixed.length > 1 ? prefixed.replace(/\/+$/, '') : prefixed;
  if (hasForbiddenPathTokens(normalized)) return null;

  if (normalized === '/' || normalized === '/index' || normalized === '/index.md') {
    return '/index.md';
  }

  const singleMatch = /^\/([a-z0-9-]+)(?:\.md)?$/.exec(normalized);
  if (singleMatch && TOP_LEVEL_MARKDOWN_PAGES.has(singleMatch[1])) {
    return `/${singleMatch[1]}.md`;
  }

  const blogMatch = BLOG_MARKDOWN_RE.exec(normalized);
  if (blogMatch) {
    return `/bai-viet/${blogMatch[1]}.md`;
  }

  const xrayMatch = XRAY_MARKDOWN_RE.exec(normalized);
  if (xrayMatch) {
    return `/xray/${xrayMatch[1]}.md`;
  }

  return null;
}

/** Slices Markdown content cleanly by character offset within tool output budgets. */
export function sliceMarkdownContent(
  markdown: string,
  offset = 0,
  maxChars = 1200,
): SlicedMarkdown {
  const cleaned = String(markdown ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_CHARS_RE, '');
  const totalLength = cleaned.length;
  const safeOffset = Number.isFinite(offset) && offset > 0 ? Math.min(Math.floor(offset), totalLength) : 0;
  const limit = Number.isFinite(maxChars) && maxChars > 0 ? Math.min(Math.floor(maxChars), WEBMCP_MAX_OUTPUT_CHARS) : 1200;

  if (safeOffset >= totalLength) {
    return {
      text: '',
      offset: safeOffset,
      nextOffset: null,
      totalLength,
    };
  }

  const end = Math.min(totalLength, safeOffset + limit);
  const text = cleaned.slice(safeOffset, end).trim();
  const nextOffset = end < totalLength ? end : null;

  return {
    text,
    offset: safeOffset,
    nextOffset,
    totalLength,
  };
}

/** Filters and ranks `/search.json` entries across title, hint, and url fields. */
export function searchEntries(
  entries: readonly SearchEntry[],
  query: string,
  kind = 'all',
  limit = 8,
): SearchEntry[] {
  const cleanQuery = sanitizeToolText(query, 200);
  if (!cleanQuery) return [];

  const maxResults = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 15) : 8;
  const normalizedKind = kind.trim().toLowerCase();
  const foldedQuery = fold(cleanQuery);

  const scored: { entry: SearchEntry; score: number }[] = [];
  for (const entry of entries) {
    if (normalizedKind && normalizedKind !== 'all' && entry.kind !== normalizedKind) continue;

    const titleHit = matches(cleanQuery, entry.title);
    const hintHit = entry.hint ? matches(cleanQuery, entry.hint) : false;
    const urlHit = fold(entry.url).includes(foldedQuery);
    if (!titleHit && !hintHit && !urlHit) continue;

    const score = (titleHit ? 4 : 0) + (hintHit ? 2 : 0) + (urlHit ? 1 : 0);
    scored.push({ entry, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults).map((row) => row.entry);
}

/** Formats search results into a compact bounded text summary. */
export function formatSearchOutput(results: readonly SearchEntry[], query: string): string {
  const cleanQuery = sanitizeToolText(query, 120);
  if (!results.length) {
    return sanitizeToolText(`Không tìm thấy kết quả phù hợp cho "${cleanQuery}".`);
  }

  const lines = results.map((entry, idx) => {
    const mdHint = toMarkdownHint(entry.url);
    const hintPart = entry.hint ? ` — ${entry.hint}` : '';
    const mdPart = mdHint ? ` (md: ${mdHint})` : '';
    return `${idx + 1}. [${entry.kind}] ${entry.title}: ${entry.url}${mdPart}${hintPart}`;
  });

  return sanitizeToolText(`Kết quả tìm kiếm (${results.length}):\n${lines.join('\n')}`);
}

function toMarkdownHint(url: string): string | null {
  if (!url.startsWith('/')) return null;
  return resolveAllowedMarkdownPath(url);
}

/** Formats catalog products or fallback search entries into bounded readable lines. */
export function formatProductsOutput(
  catalogItems: readonly CatalogItem[],
  fallbackEntries: readonly SearchEntry[] = [],
  category = '',
): string {
  const filterText = fold(category.trim());

  if (catalogItems.length > 0) {
    const filtered = filterText
      ? catalogItems.filter((item) => {
          const hay = fold(`${item.category ?? ''} ${item.name ?? ''} ${item.title ?? ''} ${item.summary ?? item.description ?? ''}`);
          return hay.includes(filterText);
        })
      : catalogItems;

    if (filtered.length > 0) {
      const lines = filtered.slice(0, 12).map((item, idx) => {
        const label = item.title || item.name || item.slug || 'Sản phẩm AI';
        const url = item.url || '/san-pham';
        const desc = item.summary || item.description;
        return `${idx + 1}. ${label} (${url})${desc ? ` — ${desc}` : ''}`;
      });
      return sanitizeToolText(`Sản phẩm & công cụ AI của DũngTQ (${filtered.length}):\n${lines.join('\n')}`);
    }
  }

  const products = fallbackEntries.filter(
    (entry) =>
      entry.kind === 'product' ||
      entry.url === '/tai-video' ||
      entry.url === '/san-pham',
  );
  const filteredFallback = filterText
    ? products.filter((entry) => fold(`${entry.title} ${entry.hint ?? ''} ${entry.url}`).includes(filterText))
    : products;

  if (!filteredFallback.length) {
    return sanitizeToolText('Không tìm thấy sản phẩm AI phù hợp trong danh mục hiện tại.');
  }

  const lines = filteredFallback.slice(0, 12).map(
    (entry, idx) => `${idx + 1}. ${entry.title} (${entry.url})${entry.hint ? ` — ${entry.hint}` : ''}`,
  );
  return sanitizeToolText(`Sản phẩm & công cụ AI của DũngTQ (${filteredFallback.length}):\n${lines.join('\n')}`);
}

/** Checks whether a section id can be opened on the desktop shell. */
export function isAllowedSectionId(value: string): value is AllowedSectionId {
  return (ALLOWED_SECTIONS as readonly string[]).includes(value);
}

/** Checks whether a preset id is supported on /tai-video. */
export function isAllowedPreset(value: string): value is AllowedTaiVideoPreset {
  return (ALLOWED_TAI_VIDEO_PRESETS as readonly string[]).includes(value);
}

/** Fetches same-origin text anonymously (no cookies or credentials). */
export async function fetchSameOriginText(
  path: string,
  accept = 'text/markdown, text/plain;q=0.9',
  signal?: AbortSignal,
): Promise<{ ok: boolean; status: number; text: string }> {
  const res = await fetch(path, {
    method: 'GET',
    credentials: 'omit',
    headers: { Accept: accept },
    signal,
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

/** Fetches same-origin JSON anonymously (no cookies or credentials). */
export async function fetchSameOriginJson<T>(path: string, signal?: AbortSignal): Promise<T | null> {
  const res = await fetch(path, {
    method: 'GET',
    credentials: 'omit',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}
