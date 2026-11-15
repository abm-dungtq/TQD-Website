// Read access to site content stored in D1. Takes the database as a parameter so it stays testable.

export interface Link {
  label: string;
  href: string;
}

// The items table still allows kind 'training' (CHECK constraint); that section was replaced by the gallery and has no rows.
export type ItemKind = 'product' | 'video';

export interface Item {
  id: number;
  kind: ItemKind;
  title: string;
  date?: string;
  summary: string;
  tags: string[];
  links?: Link[];
  tiktokId?: string;
  coverKey?: string;
  sort: number;
  visible: boolean;
}

export type SectionId = 'ho-so' | 'san-pham' | 'thu-vien' | 'video-ai' | 'bai-viet' | 'lien-he';

export type IconName = 'user' | 'box' | 'image' | 'film' | 'book' | 'chart' | 'mail' | 'download';

/** A photo or video in the gallery, stored in the media library. A video carries a poster image. */
export interface GalleryEntry {
  key: string;
  caption: string;
  poster?: string;
  /** The video that plays beside the profile on the home page. */
  featured?: boolean;
}

export const isVideoKey = (key: string): boolean => /\.(mp4|webm)$/.test(key);

/** The gallery video shown on the home page, if one is marked. */
export const featuredVideo = (gallery: GalleryEntry[]): GalleryEntry | undefined =>
  gallery.find((g) => g.featured && isVideoKey(g.key));

export interface Section {
  id: SectionId;
  title: string;
  short: string;
  icon: IconName;
}

export interface Person {
  name: string;
  handle: string;
  initials: string;
  role: string;
  intro: string;
  focus: string[];
  email: string;
  zalo: string;
  portrait: string;
  portraitSmall: string;
  portraitAlt: string;
}

export interface Stat {
  label: string;
  value: string;
  note?: string;
}

export interface GroupCount {
  label: string;
  count: number;
}

export interface Stats {
  period: string;
  headline: Stat[];
  byGroup: GroupCount[];
  source: string;
}

export interface Topics {
  howTo: string[];
  marketWatch: string[];
}

export interface Site {
  person: Person;
  stats?: Stats;
  links: Link[];
  topics: Topics;
  sections: Section[];
  gallery: GalleryEntry[];
}

export type ArticleStatus = 'draft' | 'published';

export interface Article {
  id: number;
  slug: string;
  title: string;
  summary: string;
  bodyMd: string;
  bodyHtml: string;
  coverKey?: string;
  tags: string[];
  status: ArticleStatus;
  source: string;
  fbOverlap: boolean;
  version: number;
  publishedAt?: string;
  updatedAt: string;
}

/** Everything a public page needs, loaded once per request. */
export interface SiteData {
  site: Site;
  products: Item[];
  videos: Item[];
  articles: Article[];
}

const SITE_KEYS = ['person', 'links', 'topics', 'sections', 'gallery'] as const;

const parseList = <T>(text: unknown): T[] => {
  try {
    const value = JSON.parse(String(text ?? '[]'));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

export async function getVersion(db: D1Database): Promise<number> {
  const row = await db.prepare("SELECT value FROM settings WHERE key = 'content_version'").first<{ value: string }>();
  return Number(row?.value ?? 0);
}

export async function getSite(db: D1Database): Promise<Site> {
  const placeholders = SITE_KEYS.map(() => '?').join(',');
  const { results } = await db
    .prepare(`SELECT key, value FROM settings WHERE key IN (${placeholders})`)
    .bind(...SITE_KEYS)
    .all<{ key: string; value: string }>();
  const map: Record<string, unknown> = Object.fromEntries(results.map((r) => [r.key, JSON.parse(r.value)]));
  const rawPerson = (map.person && typeof map.person === 'object' ? map.person : {}) as Partial<Person>;
  const person: Person = {
    ...(rawPerson as Person),
    zalo: rawPerson.zalo?.trim() || 'https://zalo.me/trinhquangdung',
  };
  // The gallery setting may not exist yet; every other key is seeded by the migrations.
  return { gallery: [], ...map, person } as unknown as Site;
}

interface ItemRow {
  id: number;
  kind: ItemKind;
  title: string;
  date: string | null;
  summary: string;
  tags: string;
  links: string;
  tiktok_id: string | null;
  cover_key: string | null;
  sort: number;
  visible: number;
}

export const toItem = (r: ItemRow): Item => ({
  id: r.id,
  kind: r.kind,
  title: r.title,
  date: r.date ?? undefined,
  summary: r.summary,
  tags: parseList<string>(r.tags),
  links: parseList<Link>(r.links),
  tiktokId: r.tiktok_id ?? undefined,
  coverKey: r.cover_key ?? undefined,
  sort: r.sort,
  visible: Boolean(r.visible),
});

export async function listItems(db: D1Database, kind: ItemKind, opts: { includeHidden?: boolean } = {}): Promise<Item[]> {
  const where = opts.includeHidden ? 'kind = ?' : 'kind = ? AND visible = 1';
  const { results } = await db.prepare(`SELECT * FROM items WHERE ${where} ORDER BY sort, id`).bind(kind).all<ItemRow>();
  return results.map(toItem);
}

export async function getItem(db: D1Database, id: number): Promise<Item | null> {
  const row = await db.prepare('SELECT * FROM items WHERE id = ?').bind(id).first<ItemRow>();
  return row ? toItem(row) : null;
}

interface ArticleRow {
  id: number;
  slug: string;
  title: string;
  summary: string;
  body_md: string;
  body_html: string;
  cover_key: string | null;
  tags: string;
  status: ArticleStatus;
  source: string;
  fb_overlap: number;
  version: number;
  published_at: string | null;
  updated_at: string;
}

export const toArticle = (r: ArticleRow): Article => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  summary: r.summary,
  bodyMd: r.body_md,
  bodyHtml: r.body_html,
  coverKey: r.cover_key ?? undefined,
  tags: parseList<string>(r.tags),
  status: r.status,
  source: r.source,
  fbOverlap: Boolean(r.fb_overlap),
  version: r.version,
  publishedAt: r.published_at ?? undefined,
  updatedAt: r.updated_at,
});

/** List views never need the bodies, which can be up to 100 000 characters each. */
const LIST_COLUMNS =
  "id, slug, title, summary, '' AS body_md, '' AS body_html, cover_key, tags, status, source, fb_overlap, version, published_at, updated_at";

const FULL_ARTICLE_COLUMNS =
  'id, slug, title, summary, body_md, body_html, cover_key, tags, status, source, fb_overlap, version, published_at, updated_at';

async function queryArticles(
  db: D1Database,
  opts: { columns: string; where: string; order: string; limit: number },
): Promise<Article[]> {
  const { results } = await db
    .prepare(`SELECT ${opts.columns} FROM articles ${opts.where} ORDER BY ${opts.order}, id DESC LIMIT ?1`)
    .bind(opts.limit)
    .all<ArticleRow>();
  return results.map(toArticle);
}

export async function listArticles(
  db: D1Database,
  opts: { includeDrafts?: boolean; limit?: number } = {},
): Promise<Article[]> {
  return queryArticles(db, {
    columns: LIST_COLUMNS,
    where: opts.includeDrafts ? '' : "WHERE status = 'published'",
    order: opts.includeDrafts ? 'updated_at DESC' : 'published_at DESC',
    limit: opts.limit ?? 200,
  });
}

/** Load newest published articles including full body_md and body_html (for llms-full.txt & feeds). */
export async function listRecentArticlesWithBody(db: D1Database, limit = 12): Promise<Article[]> {
  return queryArticles(db, {
    columns: FULL_ARTICLE_COLUMNS,
    where: "WHERE status = 'published'",
    order: 'published_at DESC',
    limit,
  });
}

export async function getArticle(db: D1Database, slug: string, opts: { includeDrafts?: boolean } = {}): Promise<Article | null> {
  const where = opts.includeDrafts ? 'slug = ?' : "slug = ? AND status = 'published'";
  const row = await db.prepare(`SELECT * FROM articles WHERE ${where}`).bind(slug).first<ArticleRow>();
  return row ? toArticle(row) : null;
}

export async function getArticleById(db: D1Database, id: number): Promise<Article | null> {
  const row = await db.prepare('SELECT * FROM articles WHERE id = ?').bind(id).first<ArticleRow>();
  return row ? toArticle(row) : null;
}

export async function loadSiteData(db: D1Database): Promise<SiteData> {
  const [site, products, videos, articles] = await Promise.all([
    getSite(db),
    listItems(db, 'product'),
    listItems(db, 'video'),
    listArticles(db, { limit: 50 }),
  ]);
  return { site, products, videos, articles };
}

/** Statement that bumps the cache version; run it in the same db.batch() as the write it covers. */
export const bumpVersion = (db: D1Database): D1PreparedStatement =>
  db.prepare("UPDATE settings SET value = CAST(value AS INTEGER) + 1 WHERE key = 'content_version'");

export const mediaUrl = (key: string): string => `/media/${key}`;

/** The profile intro is plain text; a blank line starts a new paragraph. */
export const introParagraphs = (intro: string): string[] =>
  intro
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

const FALLBACK_LASTMOD = '2026-10-12';
const FALLBACK_ISO_UTC = `${FALLBACK_LASTMOD}T00:00:00.000Z`;

/** Normalize SQLite `YYYY-MM-DD HH:MM:SS`, date-only, or ISO strings into full ISO 8601 UTC (`...Z`). */
export function toIsoUtc(dateLike: string): string {
  const raw = dateLike.trim();
  if (!raw) return FALLBACK_ISO_UTC;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? `${raw}T00:00:00Z`
    : /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(raw)
      ? `${raw.replace(' ', 'T')}Z`
      : raw;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? FALLBACK_ISO_UTC : parsed.toISOString();
}

/** Clamp a meta description cleanly on a word boundary, appending `…` when truncated. */
export function clampMetaDescription(text: string, max = 158): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean || max <= 0) return '';
  if (clean.length <= max) return clean;
  if (max === 1) return '…';
  const slice = clean.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(' ');
  const boundary = lastSpace >= Math.floor((max - 1) * 0.5) ? slice.slice(0, lastSpace) : slice;
  return `${boundary.replace(/[\s,;:.·-]+$/, '')}…`;
}

export const SECTION_SEO: Record<SectionId, { title: string; description: string }> = {
  'ho-so': {
    title: 'Hồ sơ năng lực đào tạo và triển khai AI thực tế',
    description:
      'Kinh nghiệm đào tạo AI nội bộ tại BSR, Agribank, ABIC, Hanoitourist và thiết kế AI Agent, Skill vận hành doanh nghiệp của Trịnh Quang Dũng.',
  },
  'san-pham': {
    title: 'Sản phẩm phần mềm, Skill và công cụ AI thực chiến',
    description:
      'Hệ sinh thái sản phẩm AI và mã nguồn mở của Trịnh Quang Dũng: Viết Pro v6, China Sourcing, Tải Video Viral, Tử Vi Thiên Kỷ, TQD KidGuard và TQD Browser.',
  },
  'thu-vien': {
    title: 'Thư viện hình ảnh và video đào tạo AI doanh nghiệp',
    description:
      'Tư liệu hình ảnh và video các buổi huấn luyện AI cho doanh nghiệp, lớp thực hành xây dựng Agent và quy trình vận hành cùng Trịnh Quang Dũng.',
  },
  'video-ai': {
    title: 'Video AI, phim ngắn và thử nghiệm kịch bản thực tế',
    description:
      'Tuyển tập video sản xuất bằng AI, phim ngắn thử nghiệm và chia sẻ quy trình dựng kịch bản từ kênh TikTok @abmdungtq của Trịnh Quang Dũng.',
  },
  'bai-viet': {
    title: 'Bài viết kỹ thuật AI Agent, Skill và vận hành SME',
    description:
      'Ghi chép thực chiến về thiết kế AI Agent, đóng gói Skill chống văn mẫu Viết Pro, tối ưu chi phí và đưa AI vào công việc hằng ngày tại Việt Nam.',
  },
  'lien-he': {
    title: 'Liên hệ đặt lịch đào tạo và tư vấn triển khai AI',
    description:
      'Kết nối trực tiếp với Trịnh Quang Dũng qua Zalo, email công việc hoặc GitHub để trao đổi đào tạo AI nội bộ và thiết kế Agent cho doanh nghiệp.',
  },
};

async function rawLastModified(db: D1Database): Promise<string | null> {
  const row = await db
    .prepare('SELECT MAX(m) AS m FROM (SELECT MAX(updated_at) AS m FROM items UNION ALL SELECT MAX(updated_at) FROM articles)')
    .first<{ m: string | null }>();
  return row?.m ?? null;
}

/** Most recent update date (YYYY-MM-DD) across content, for sitemaps. */
export async function lastModified(db: D1Database): Promise<string> {
  return ((await rawLastModified(db)) ?? FALLBACK_LASTMOD).slice(0, 10);
}

/** Most recent update timestamp in full ISO 8601 UTC format across content. */
export async function lastModifiedIso(db: D1Database): Promise<string> {
  return toIsoUtc((await rawLastModified(db)) ?? FALLBACK_LASTMOD);
}
