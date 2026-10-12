// Article writes shared by /admin and the agent API. Each write bumps content_version in the same batch.
import { type Article, type ArticleStatus, bumpVersion, toArticle } from './content';
import { hasFacebookOverlap } from './fb-overlap';
import { renderMarkdown } from './markdown';

export interface ArticleInput {
  /** Admin edits by id so the slug can change; the API addresses articles by slug. */
  id?: number;
  slug: string;
  title: string;
  summary: string;
  bodyMd: string;
  tags: string[];
  coverKey?: string | null;
  status: ArticleStatus;
}

export class ValidationError extends Error {
  constructor(readonly errors: string[]) {
    super(errors.join('\n'));
  }
}

export class ConflictError extends Error {
  constructor(readonly currentVersion: number) {
    super('Bài đã được sửa ở nơi khác.');
  }
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
}

export function validateArticle(input: ArticleInput): string[] {
  const errors: string[] = [];
  if (!SLUG.test(input.slug) || input.slug.length > 80) errors.push('Slug chỉ gồm chữ thường không dấu, số và dấu gạch ngang, tối đa 80 ký tự.');
  if (input.title.length < 1 || input.title.length > 200) errors.push('Tiêu đề cần 1–200 ký tự.');
  if (input.summary.length > 500) errors.push('Tóm tắt tối đa 500 ký tự.');
  if (input.bodyMd.length < 1 || input.bodyMd.length > 100_000) errors.push('Nội dung cần 1–100 000 ký tự.');
  if (input.tags.length > 10) errors.push('Tối đa 10 thẻ.');
  if (input.tags.some((t) => t.length > 40)) errors.push('Mỗi thẻ tối đa 40 ký tự.');
  if (input.status !== 'draft' && input.status !== 'published') errors.push('Trạng thái phải là nháp hoặc đăng.');
  return errors;
}

export async function saveArticle(
  db: D1Database,
  input: ArticleInput,
  opts: { source: string; expectedVersion?: number },
): Promise<{ article: Article; created: boolean }> {
  const errors = validateArticle(input);
  const coverKey = input.coverKey || null;
  if (coverKey && !(await db.prepare("SELECT 1 FROM media WHERE key = ?1 AND content_type LIKE 'image/%'").bind(coverKey).first())) {
    errors.push('Ảnh bìa phải là ảnh trong thư viện media.');
  }
  const current = input.id
    ? await db.prepare('SELECT id, slug, version FROM articles WHERE id = ?1').bind(input.id).first<{ id: number; slug: string; version: number }>()
    : await db.prepare('SELECT id, slug, version FROM articles WHERE slug = ?1').bind(input.slug).first<{ id: number; slug: string; version: number }>();
  if (input.id && !current) errors.push('Không tìm thấy bài.');
  if (current && current.slug !== input.slug && (await db.prepare('SELECT 1 FROM articles WHERE slug = ?1').bind(input.slug).first())) {
    errors.push('Slug đã được bài khác dùng.');
  }
  if (errors.length) throw new ValidationError(errors);
  if (current && opts.expectedVersion !== undefined && opts.expectedVersion !== current.version) {
    throw new ConflictError(current.version);
  }

  const bodyHtml = await renderMarkdown(input.bodyMd);
  const fbOverlap = hasFacebookOverlap(`${input.title} ${input.summary} ${input.bodyMd}`) ? 1 : 0;
  const values = [input.slug, input.title, input.summary, input.bodyMd, bodyHtml, coverKey, JSON.stringify(input.tags), input.status, opts.source, fbOverlap];

  const write = current
    ? db
        .prepare(
          `UPDATE articles SET slug = ?1, title = ?2, summary = ?3, body_md = ?4, body_html = ?5, cover_key = ?6, tags = ?7,
             status = ?8, source = ?9, fb_overlap = ?10, version = version + 1, updated_at = datetime('now'),
             published_at = CASE WHEN ?8 = 'published' AND published_at IS NULL THEN datetime('now') ELSE published_at END
           WHERE id = ?11 AND version = ?12 RETURNING *`,
        )
        .bind(...values, current.id, current.version)
    : db
        .prepare(
          `INSERT INTO articles (slug, title, summary, body_md, body_html, cover_key, tags, status, source, fb_overlap, published_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, CASE WHEN ?8 = 'published' THEN datetime('now') END) RETURNING *`,
        )
        .bind(...values);
  let result: D1Result;
  try {
    [result] = await db.batch([write, bumpVersion(db)]);
  } catch (e) {
    // Another writer took the slug between the read and the write.
    if (!String(e).includes('UNIQUE constraint failed')) throw e;
    const taken = await db.prepare('SELECT version FROM articles WHERE slug = ?1').bind(input.slug).first<{ version: number }>();
    throw new ConflictError(taken?.version ?? 0);
  }
  const row = result.results[0] as Parameters<typeof toArticle>[0] | undefined;
  // Another writer won between the read and the update.
  if (!row) throw new ConflictError(current ? current.version + 1 : 0);
  return { article: toArticle(row), created: !current };
}

export async function deleteArticle(db: D1Database, slug: string): Promise<boolean> {
  const [result] = await db.batch([db.prepare('DELETE FROM articles WHERE slug = ?1').bind(slug), bumpVersion(db)]);
  return (result.meta.changes ?? 0) > 0;
}
