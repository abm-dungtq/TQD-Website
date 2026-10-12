// Read access to site content stored in D1. Takes the database as a parameter so it stays testable.

export interface Link {
  label: string;
  href: string;
}

export type ItemKind = 'product' | 'training' | 'video';

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

export type SectionId = 'ho-so' | 'san-pham' | 'dao-tao' | 'video-ai' | 'bai-viet' | 'so-lieu' | 'lien-he';

export type IconName = 'user' | 'box' | 'presentation' | 'film' | 'book' | 'chart' | 'mail';

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
  stats: Stats;
  links: Link[];
  topics: Topics;
  sections: Section[];
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
  trainings: Item[];
  videos: Item[];
  articles: Article[];
}

const SITE_KEYS = ['person', 'stats', 'links', 'topics', 'sections'] as const;

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
  const map = Object.fromEntries(results.map((r) => [r.key, JSON.parse(r.value)]));
  return map as Site;
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

export async function listArticles(
  db: D1Database,
  opts: { includeDrafts?: boolean; limit?: number } = {},
): Promise<Article[]> {
  const where = opts.includeDrafts ? '' : "WHERE status = 'published'";
  const order = opts.includeDrafts ? 'updated_at DESC' : 'published_at DESC';
  const { results } = await db
    .prepare(`SELECT ${LIST_COLUMNS} FROM articles ${where} ORDER BY ${order}, id DESC LIMIT ?`)
    .bind(opts.limit ?? 200)
    .all<ArticleRow>();
  return results.map(toArticle);
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
  const [site, products, trainings, videos, articles] = await Promise.all([
    getSite(db),
    listItems(db, 'product'),
    listItems(db, 'training'),
    listItems(db, 'video'),
    listArticles(db, { limit: 50 }),
  ]);
  return { site, products, trainings, videos, articles };
}

/** Statement that bumps the cache version; run it in the same db.batch() as the write it covers. */
export const bumpVersion = (db: D1Database): D1PreparedStatement =>
  db.prepare("UPDATE settings SET value = CAST(value AS INTEGER) + 1 WHERE key = 'content_version'");

export const mediaUrl = (key: string): string => `/media/${key}`;

/** Most recent update date (YYYY-MM-DD) across content, for sitemaps. */
export async function lastModified(db: D1Database): Promise<string> {
  const row = await db
    .prepare('SELECT MAX(m) AS m FROM (SELECT MAX(updated_at) AS m FROM items UNION ALL SELECT MAX(updated_at) FROM articles)')
    .first<{ m: string | null }>();
  return (row?.m ?? '2026-10-12').slice(0, 10);
}
