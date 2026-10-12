// Admin writes. Every write runs in one db.batch() with bumpVersion so cached pages refresh.
import { bumpVersion, type ItemKind, type Link } from './content';

/** Bad form input; the message is shown to the admin as is. */
export class InputError extends Error {}

export const KIND_BY_SLUG: Record<string, ItemKind> = { 'san-pham': 'product', 'dao-tao': 'training', video: 'video' };
export const KIND_LABEL: Record<ItemKind, string> = { product: 'Sản phẩm', training: 'Đào tạo', video: 'Video' };

export const LIMITS = { title: 200, summary: 1000, intro: 2000 } as const;

export function checkLength(label: string, value: string, max: number): string {
  if (value.length > max) throw new InputError(`${label} dài quá ${max} ký tự.`);
  return value;
}

export async function saveSetting(db: D1Database, key: string, value: unknown): Promise<void> {
  await db.batch([
    db
      .prepare('INSERT INTO settings(key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .bind(key, JSON.stringify(value)),
    bumpVersion(db),
  ]);
}

/** One link per line: `Label | https://...`. Accepts https, http and mailto only. */
export function parseLinks(text: string): Link[] {
  const links: Link[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    const bar = line.indexOf('|');
    const label = bar < 0 ? '' : line.slice(0, bar).trim();
    const href = bar < 0 ? '' : line.slice(bar + 1).trim();
    let ok = Boolean(label && href);
    if (ok) {
      try {
        ok = ['https:', 'http:', 'mailto:'].includes(new URL(href).protocol);
      } catch {
        ok = false;
      }
    }
    if (!ok) throw new InputError(`Dòng ${i + 1}: cần dạng "Nhãn | https://..."`);
    links.push({ label, href });
  });
  return links;
}

export const formatLinks = (links: Link[] = []): string => links.map((l) => `${l.label} | ${l.href}`).join('\n');

export interface ItemInput {
  id?: number;
  kind: ItemKind;
  title: string;
  date: string | null;
  summary: string;
  tags: string[];
  links: Link[];
  sort: number;
  visible: boolean;
}

export function itemFromForm(form: FormData, kind: ItemKind): ItemInput {
  const text = (name: string) => String(form.get(name) ?? '').trim();
  const title = checkLength('Tiêu đề', text('title'), LIMITS.title);
  if (!title) throw new InputError('Cần tiêu đề.');
  const sort = Number(text('sort') || 0);
  if (!Number.isInteger(sort)) throw new InputError('Thứ tự phải là số nguyên.');
  return {
    kind,
    title,
    date: text('date') || null,
    summary: checkLength('Tóm tắt', text('summary'), LIMITS.summary),
    tags: text('tags')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    links: parseLinks(text('links')),
    sort,
    visible: form.get('visible') === 'on',
  };
}

export async function saveItem(db: D1Database, input: ItemInput): Promise<void> {
  const values = [
    input.title,
    input.date,
    input.summary,
    JSON.stringify(input.tags),
    JSON.stringify(input.links),
    input.sort,
    input.visible ? 1 : 0,
  ];
  const write = input.id
    ? db
        .prepare(
          `UPDATE items SET title = ?1, date = ?2, summary = ?3, tags = ?4, links = ?5, sort = ?6, visible = ?7,
           updated_at = datetime('now') WHERE id = ?8`,
        )
        .bind(...values, input.id)
    : db
        .prepare(
          `INSERT INTO items(title, date, summary, tags, links, sort, visible, kind, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'))`,
        )
        .bind(...values, input.kind);
  await db.batch([write, bumpVersion(db)]);
}

export async function deleteItem(db: D1Database, id: number): Promise<void> {
  await db.batch([db.prepare('DELETE FROM items WHERE id = ?1').bind(id), bumpVersion(db)]);
}
