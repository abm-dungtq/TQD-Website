// Origin API client: EzyPlatform's public post endpoints are the source of truth for articles, products, videos
// and the gallery. All reads carry the edge's secret header; the VPS answers 403 without it.
import {
  FALLBACK_GALLERY,
  OPEN_FALLBACK_DATE,
  type GalleryEntry,
  type Link,
  type ReaderArticle,
  type ReaderData,
  type ReaderItem,
  SITE,
  toIsoUtc,
} from './site';
import { htmlToMarkdown, htmlToText } from './html-to-md';

const LIST_TTL_MS = 60_000;
const POST_TTL_MS = 300_000;
const PAGE_LIMIT = 100;
const MAX_PAGES = 6;
const FETCH_TIMEOUT_MS = 8_000;
const ORIGIN_HEADER = 'X-TQD-Origin-Key';

export interface OriginEnv {
  ORIGIN_WEB: string;
  ORIGIN_KEY?: string;
}

export interface OriginPostSummary {
  id: number;
  slug: string;
  title: string;
  summary?: string;
  type?: string;
  postType?: string;
  status?: string;
  publishedAt?: number | string;
  updatedAt?: number | string;
  createdAt?: number | string;
  terms?: Array<{ name?: string; title?: string; slug?: string }>;
}

export interface OriginPost extends OriginPostSummary {
  content?: string;
  contentType?: string;
}

export class OriginError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'OriginError';
  }
}

interface CachedList {
  at: number;
  items: OriginPostSummary[];
}

const listCache = new Map<string, CachedList>();
const postCache = new Map<string, { at: number; post: OriginPost | null }>();

/** The post type EzyPlatform stores in `postType` (list items expose it as `type`). */
const postTypeOf = (post: OriginPostSummary): string => post.postType ?? post.type ?? '';

/** ISO 8601 for an origin date, or `undefined` when the API omitted/invalidated it. */
const postIso = (value?: number | string | null): string | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const iso = toIsoUtc(value);
  return iso === OPEN_FALLBACK_DATE ? undefined : iso;
};

async function fetchJson<T>(env: OriginEnv, path: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<T> {
  if (!env.ORIGIN_KEY) throw new OriginError('ORIGIN_KEY is not configured', 503);
  let response: Response;
  try {
    response = await fetch(new URL(path, env.ORIGIN_WEB), {
      headers: {
        [ORIGIN_HEADER]: env.ORIGIN_KEY,
        accept: 'application/json',
        'user-agent': 'tqd-edge/1.0',
      },
      signal: AbortSignal.timeout(timeoutMs),
      cf: { cacheTtl: 60, cacheEverything: true },
    });
  } catch (error) {
    throw new OriginError(`origin unreachable: ${(error as Error).message}`, 502);
  }
  if (!response.ok) {
    throw new OriginError(`origin ${response.status} for ${path}`, response.status === 404 ? 404 : 502);
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw new OriginError(`origin returned invalid JSON for ${path}`, 502);
  }
}

/** Published posts, one page at a time, cached for a minute per isolate. */
export async function listPosts(env: OriginEnv): Promise<OriginPostSummary[]> {
  const cacheKey = env.ORIGIN_WEB;
  const cached = listCache.get(cacheKey);
  if (cached && Date.now() - cached.at < LIST_TTL_MS) return cached.items;

  const items: OriginPostSummary[] = [];
  let nextToken: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query = new URLSearchParams({ limit: String(PAGE_LIMIT) });
    if (nextToken) query.set('nextPageToken', nextToken);
    const payload = await fetchJson<{ items?: OriginPostSummary[]; pageToken?: { next?: string | null } }>(
      env,
      `/api/v1/posts?${query.toString()}`,
    );
    const batch = Array.isArray(payload.items) ? payload.items : [];
    items.push(...batch.filter((item) => item && item.slug && (item.status ?? 'PUBLISHED').toUpperCase() === 'PUBLISHED'));
    const next = payload.pageToken?.next ?? null;
    if (!next || batch.length === 0 || next === nextToken) break;
    nextToken = next;
  }

  items.sort((a, b) => Date.parse(postIso(b.publishedAt ?? b.updatedAt) ?? '') - Date.parse(postIso(a.publishedAt ?? a.updatedAt) ?? '') || 0);
  listCache.set(cacheKey, { at: Date.now(), items });
  return items;
}

/** Full post by slug; `null` when the origin has no published post with that slug. */
export async function getPost(env: OriginEnv, slug: string): Promise<OriginPost | null> {
  const key = `${env.ORIGIN_WEB}|${slug}`;
  const cached = postCache.get(key);
  if (cached && Date.now() - cached.at < POST_TTL_MS) return cached.post;

  let post: OriginPost | null;
  try {
    const payload = await fetchJson<OriginPost | { post?: OriginPost }>(
      env,
      `/api/v1/posts/${encodeURIComponent(slug)}`,
    );
    post = 'post' in payload && payload.post ? payload.post : (payload as OriginPost);
    if (post && (post.status ?? 'PUBLISHED').toUpperCase() !== 'PUBLISHED') post = null;
  } catch (error) {
    if (error instanceof OriginError && error.status === 404) {
      post = null;
    } else {
      throw error;
    }
  }
  postCache.set(key, { at: Date.now(), post });
  return post;
}

const TERM_NAMES = (post: OriginPostSummary): string[] =>
  (post.terms ?? [])
    .map((term) => (term.name ?? term.title ?? term.slug ?? '').trim())
    .filter((name) => name.length > 0);

const vnDate = (value?: number | string): string | undefined => {
  const iso = postIso(value);
  if (!iso) return undefined;
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' })
    .format(new Date(iso));
};

const safeAbsUrl = (raw: string, origin: string): string | undefined => {
  const href = raw.trim();
  if (!href || /[\u0000-\u001F\u007F\\]/.test(href)) return undefined;
  if (href.startsWith('//')) return undefined;
  if (href.startsWith('/')) return `${origin}${href}`;
  try {
    const url = new URL(href);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};

const anchorLabel = (inner: string, url: string): string => {
  const text = htmlToText(inner);
  if (text) return text.length > 60 ? `${text.slice(0, 57)}…` : text;
  try {
    return new URL(url).hostname.replace(/^www\./, '') || url;
  } catch {
    return url;
  }
};

export function extractLinks(html: string, origin: string): Link[] {
  const links: Link[] = [];
  const seen = new Set<string>();
  const anchorRe = /<a\b[^>]*href\s*=\s*"([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorRe.exec(html)) !== null) {
    const url = safeAbsUrl(match[1], origin);
    if (!url || url.startsWith('mailto:') || seen.has(url)) continue;
    seen.add(url);
    links.push({ label: anchorLabel(match[2], url), href: url });
    if (links.length >= 12) break;
  }
  return links;
}

export function extractFirstImage(html: string, origin: string): string | undefined {
  const imgRe = /<(?:img|source|video)\b[^>]*(?:src|poster)\s*=\s*"([^"]+)"/i;
  const match = imgRe.exec(html);
  return match ? safeAbsUrl(match[1], origin) : undefined;
}

export function extractFirstMediaHref(html: string, origin: string): string | undefined {
  return extractFirstImage(html, origin);
}

export function extractTikTokId(html: string): string | undefined {
  const match = /tiktok\.com\/(?:player\/v1|embed\/v2)\/(\d{6,})/i.exec(html);
  return match?.[1];
}

const clampText = (text: string, max = 300): string => {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice).trim()}…`;
};

/** Summary fallback for migrated cards that only carry the rendered HTML body. */
export function deriveSummary(html: string, title: string): string {
  const text = htmlToText(html);
  const stripped = title && text.startsWith(title) ? text.slice(title.length).trim() : text;
  return clampText(stripped || text);
}

export function toReaderItem(post: OriginPost | OriginPostSummary, origin: string): ReaderItem {
  const full = post as OriginPost;
  const content = full.content ?? '';
  return {
    id: post.id,
    title: post.title,
    summary: (post.summary ?? '').trim() || (content ? deriveSummary(content, post.title) : ''),
    tags: TERM_NAMES(post),
    date: vnDate(post.publishedAt ?? post.createdAt),
    links: content ? extractLinks(content, origin) : [],
    tiktokId: content ? extractTikTokId(content) : undefined,
    imageUrl: content ? extractFirstImage(content, origin) : undefined,
  };
}

export interface LoadReaderDataOptions {
  withProductBodies?: boolean;
  withVideoBodies?: boolean;
  withGalleryBodies?: boolean;
  /** How many of the newest articles to load with their body (0 = summaries only). */
  articleBodies?: number;
}

const isArticle = (post: OriginPostSummary): boolean => postTypeOf(post) === 'POST';

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Loads everything a reader endpoint needs, fetching full bodies only for the requested groups. */
export async function loadReaderData(
  env: OriginEnv,
  origin: string,
  options: LoadReaderDataOptions = {},
): Promise<{ data: ReaderData; originOk: boolean }> {
  let items: OriginPostSummary[] = [];
  let originOk = true;
  try {
    items = await listPosts(env);
  } catch {
    originOk = false;
  }

  const products = items.filter((post) => postTypeOf(post) === 'tqd_product');
  const videos = items.filter((post) => postTypeOf(post) === 'tqd_video');
  const galleryPosts = items.filter((post) => postTypeOf(post) === 'tqd_gallery');
  const articleSummaries = items.filter(isArticle);

  const fullPosts = async (posts: OriginPostSummary[], wanted: boolean): Promise<Array<OriginPost | OriginPostSummary>> => {
    if (!wanted || posts.length === 0) return posts;
    return mapWithConcurrency(posts, 6, async (post) => (await getPost(env, post.slug).catch(() => null)) ?? post);
  };

  const [fullProducts, fullVideos, fullGallery] = await Promise.all([
    fullPosts(products, Boolean(options.withProductBodies)),
    fullPosts(videos, Boolean(options.withVideoBodies)),
    fullPosts(galleryPosts, Boolean(options.withGalleryBodies)),
  ]);

  const bodyCount = Math.max(0, options.articleBodies ?? 0);
  const articleBodies = new Map<string, string>();
  if (bodyCount > 0) {
    await mapWithConcurrency(articleSummaries.slice(0, bodyCount), 6, async (post) => {
      const full = await getPost(env, post.slug).catch(() => null);
      if (full?.content) articleBodies.set(post.slug, htmlToMarkdown(full.content));
      return null;
    });
  }

  const articles: ReaderArticle[] = articleSummaries.map((post) => ({
    id: post.id,
    slug: post.slug,
    title: post.title,
    summary: (post.summary ?? '').trim(),
    bodyMd: articleBodies.get(post.slug) ?? '',
    tags: TERM_NAMES(post),
    publishedAt: postIso(post.publishedAt),
    updatedAt: postIso(post.updatedAt),
  }));

  const gallery: GalleryEntry[] = fullGallery
    .map((post) => {
      const href = extractFirstMediaHref((post as OriginPost).content ?? '', origin);
      return href ? { caption: post.title, href } : null;
    })
    .filter((entry): entry is GalleryEntry => entry !== null);

  return {
    data: {
      site: SITE,
      products: fullProducts.map((post) => toReaderItem(post, origin)),
      videos: fullVideos.map((post) => toReaderItem(post, origin)),
      gallery: gallery.length > 0 ? gallery : FALLBACK_GALLERY,
      articles,
    },
    originOk,
  };
}
