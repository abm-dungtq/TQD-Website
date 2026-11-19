import { getVnDayOffset } from '../analytics/wae-client';

export const SEO_INTENTS = ['informational', 'commercial', 'transactional', 'navigational'] as const;
export type SeoIntent = (typeof SEO_INTENTS)[number];

export const SEO_PRIORITIES = ['high', 'medium', 'low'] as const;
export type SeoPriority = (typeof SEO_PRIORITIES)[number];

export const SEO_STATUSES = ['idea', 'planned', 'drafting', 'published', 'archived'] as const;
export type SeoStatus = (typeof SEO_STATUSES)[number];

export interface SeoKeywordInput {
  keyword: string;
  cluster?: string;
  intent?: SeoIntent;
  priority?: SeoPriority;
  status?: SeoStatus;
  volume?: number | null;
  difficulty?: number | null;
  cpc?: number | null;
  source?: string;
  targetSlug?: string | null;
  suggestedTitle?: string;
  notes?: string;
}

export interface SeoKeywordRow {
  id: number;
  keywordNorm: string;
  keyword: string;
  cluster: string;
  intent: SeoIntent;
  priority: SeoPriority;
  status: SeoStatus;
  volume: number | null;
  difficulty: number | null;
  cpc: number | null;
  source: string;
  targetSlug: string | null;
  suggestedTitle: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  articleId: number | null;
  articleStatus: string | null;
  articleTitle: string | null;
}

export interface GscDailyRow {
  day: string;
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscQuerySummary {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  topPage: string;
}

export interface LowCtrOpportunity extends GscQuerySummary {
  actionHint: string;
}

export interface GscSnapshotInfo {
  syncedAt?: string;
  siteUrl?: string;
  rowsSynced?: number;
  sitemaps?: Array<{
    path: string;
    lastSubmitted?: string | null;
    lastDownloaded?: string | null;
    isPending?: boolean;
    warnings?: number;
    errors?: number;
  }>;
  lastError?: string | null;
}

export interface SeoDashboardData {
  siteUrl: string;
  rangeDays: number;
  fromDay: string;
  toDay: string;
  gscTotals: {
    clicks: number;
    impressions: number;
    ctr: number;
    avgPosition: number;
    queryCount: number;
    latestDay: string | null;
  };
  topQueries: GscQuerySummary[];
  lowCtrOpportunities: LowCtrOpportunity[];
  strikingDistance: GscQuerySummary[];
  keywords: SeoKeywordRow[];
  totalKeywords: number;
  countsByStatus: Record<SeoStatus, number>;
  clusters: string[];
  gscSnapshot: { data: GscSnapshotInfo; updatedAt: string } | null;
  auditSnapshot: { data: Record<string, unknown>; updatedAt: string } | null;
}

export function normalizeKeywordKey(raw: string): string {
  return raw.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function normalizeIntent(raw: unknown, fallback: SeoIntent = 'informational'): SeoIntent {
  return SEO_INTENTS.includes(raw as SeoIntent) ? (raw as SeoIntent) : fallback;
}

export function normalizePriority(raw: unknown, fallback: SeoPriority = 'medium'): SeoPriority {
  return SEO_PRIORITIES.includes(raw as SeoPriority) ? (raw as SeoPriority) : fallback;
}

export function normalizeStatus(raw: unknown, fallback: SeoStatus = 'idea'): SeoStatus {
  return SEO_STATUSES.includes(raw as SeoStatus) ? (raw as SeoStatus) : fallback;
}

function finiteIntOrNull(val: unknown, min = 0, max = 100_000_000): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < min || rounded > max) return null;
  return rounded;
}

function finiteFloatOrNull(val: unknown, min = 0, max = 10_000): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return Math.round(n * 100) / 100;
}

function cleanSlug(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().replace(/^\/bai-viet\//, '').replace(/^\/+/, '').slice(0, 80);
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) ? s : null;
}

/** Upserts keyword backlog entries cleanly in D1 batches. */
export async function upsertSeoKeywords(db: D1Database, items: SeoKeywordInput[]): Promise<number> {
  const deduped = new Map<string, SeoKeywordInput>();
  for (const item of items) {
    if (!item || typeof item.keyword !== 'string') continue;
    const cleaned = item.keyword.normalize('NFKC').trim().replace(/\s+/g, ' ');
    if (!cleaned) continue;
    const norm = normalizeKeywordKey(cleaned);
    if (!deduped.has(norm)) {
      deduped.set(norm, { ...item, keyword: cleaned.slice(0, 160) });
    }
  }
  if (deduped.size === 0) return 0;

  const stmtSql = `
    INSERT INTO seo_keywords (
      keyword_norm, keyword, cluster, intent, priority, status,
      volume, difficulty, cpc, source, target_slug, suggested_title, notes
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
    ON CONFLICT(keyword_norm) DO UPDATE SET
      keyword = excluded.keyword,
      cluster = CASE WHEN excluded.cluster != '' THEN excluded.cluster ELSE seo_keywords.cluster END,
      intent = excluded.intent,
      priority = COALESCE(NULLIF(?14, ''), seo_keywords.priority),
      status = COALESCE(NULLIF(?15, ''), seo_keywords.status),
      volume = COALESCE(excluded.volume, seo_keywords.volume),
      difficulty = COALESCE(excluded.difficulty, seo_keywords.difficulty),
      cpc = COALESCE(excluded.cpc, seo_keywords.cpc),
      source = CASE WHEN seo_keywords.source = '' THEN excluded.source ELSE seo_keywords.source END,
      target_slug = COALESCE(excluded.target_slug, seo_keywords.target_slug),
      suggested_title = CASE WHEN excluded.suggested_title != '' THEN excluded.suggested_title ELSE seo_keywords.suggested_title END,
      notes = CASE WHEN excluded.notes != '' THEN excluded.notes ELSE seo_keywords.notes END,
      updated_at = datetime('now')
  `;

  const stmts: D1PreparedStatement[] = [];
  for (const [norm, item] of deduped.entries()) {
    const cluster = (item.cluster ?? '').trim().slice(0, 120);
    const intent = normalizeIntent(item.intent);
    const priorityInsert = normalizePriority(item.priority ?? 'medium');
    const priorityUpdate = item.priority ? normalizePriority(item.priority) : '';
    const statusInsert = normalizeStatus(item.status ?? 'idea');
    const statusUpdate = item.status ? normalizeStatus(item.status) : '';
    const volume = finiteIntOrNull(item.volume);
    const difficulty = finiteIntOrNull(item.difficulty, 0, 100);
    const cpc = finiteFloatOrNull(item.cpc);
    const source = (item.source ?? 'admin').trim().slice(0, 60) || 'admin';
    const targetSlug = cleanSlug(item.targetSlug);
    const suggestedTitle = (item.suggestedTitle ?? '').trim().slice(0, 220);
    const notes = (item.notes ?? '').trim().slice(0, 1000);

    stmts.push(
      db
        .prepare(stmtSql)
        .bind(
          norm.slice(0, 160),
          item.keyword,
          cluster,
          intent,
          priorityInsert,
          statusInsert,
          volume,
          difficulty,
          cpc,
          source,
          targetSlug,
          suggestedTitle,
          notes,
          priorityUpdate,
          statusUpdate,
        ),
    );
  }

  for (let i = 0; i < stmts.length; i += 50) {
    await db.batch(stmts.slice(i, i + 50));
  }
  return stmts.length;
}

export async function updateSeoKeyword(
  db: D1Database,
  id: number,
  patch: {
    status?: SeoStatus;
    priority?: SeoPriority;
    intent?: SeoIntent;
    cluster?: string;
    targetSlug?: string | null;
    suggestedTitle?: string;
    notes?: string;
  },
): Promise<boolean> {
  if (!Number.isInteger(id) || id <= 0) return false;
  const existing = await db
    .prepare('SELECT id, cluster, intent, priority, status, target_slug, suggested_title, notes FROM seo_keywords WHERE id = ?1')
    .bind(id)
    .first<{
      id: number;
      cluster: string;
      intent: SeoIntent;
      priority: SeoPriority;
      status: SeoStatus;
      target_slug: string | null;
      suggested_title: string;
      notes: string;
    }>();
  if (!existing) return false;

  const status = patch.status !== undefined ? normalizeStatus(patch.status, existing.status) : existing.status;
  const priority = patch.priority !== undefined ? normalizePriority(patch.priority, existing.priority) : existing.priority;
  const intent = patch.intent !== undefined ? normalizeIntent(patch.intent, existing.intent) : existing.intent;
  const cluster = patch.cluster !== undefined ? patch.cluster.trim().slice(0, 120) : existing.cluster;
  const targetSlug =
    patch.targetSlug !== undefined
      ? patch.targetSlug
        ? cleanSlug(patch.targetSlug)
        : null
      : existing.target_slug;
  const suggestedTitle =
    patch.suggestedTitle !== undefined ? patch.suggestedTitle.trim().slice(0, 220) : existing.suggested_title;
  const notes = patch.notes !== undefined ? patch.notes.trim().slice(0, 1000) : existing.notes;

  const res = await db
    .prepare(
      `UPDATE seo_keywords
       SET status = ?1, priority = ?2, intent = ?3, cluster = ?4, target_slug = ?5, suggested_title = ?6, notes = ?7, updated_at = datetime('now')
       WHERE id = ?8`,
    )
    .bind(status, priority, intent, cluster, targetSlug, suggestedTitle, notes, id)
    .run();

  return (res.meta?.changes ?? 0) > 0;
}

export async function deleteSeoKeyword(db: D1Database, id: number): Promise<boolean> {
  if (!Number.isInteger(id) || id <= 0) return false;
  const res = await db.prepare('DELETE FROM seo_keywords WHERE id = ?1').bind(id).run();
  return (res.meta?.changes ?? 0) > 0;
}

/** Upserts Google Search Console daily rows in bounded D1 batches. */
export async function upsertGscDailyRows(db: D1Database, site: string, rows: GscDailyRow[]): Promise<number> {
  const cleanSite = (site || 'sc-domain:tqd.me').trim().slice(0, 120);
  const validRows = rows.filter(
    (r) =>
      typeof r.day === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(r.day) &&
      typeof r.query === 'string' &&
      r.query.trim().length > 0 &&
      Number.isFinite(r.clicks) &&
      Number.isFinite(r.impressions),
  );
  if (validRows.length === 0) return 0;

  const stmts = validRows.map((r) =>
    db
      .prepare(
        `INSERT OR REPLACE INTO seo_gsc_daily (site, day, query, page, clicks, impressions, ctr, position)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      )
      .bind(
        cleanSite,
        r.day,
        r.query.trim().slice(0, 250),
        (r.page ?? '').trim().slice(0, 300),
        Math.max(0, r.clicks),
        Math.max(0, r.impressions),
        Number.isFinite(r.ctr) ? Math.max(0, Math.min(1, r.ctr)) : 0,
        Number.isFinite(r.position) ? Math.max(0, r.position) : 0,
      ),
  );

  for (let i = 0; i < stmts.length; i += 80) {
    await db.batch(stmts.slice(i, i + 80));
  }
  return stmts.length;
}

export async function saveSeoSnapshot(db: D1Database, key: string, data: unknown): Promise<void> {
  await db
    .prepare(
      `INSERT INTO seo_snapshots (key, value_json, updated_at)
       VALUES (?1, ?2, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = datetime('now')`,
    )
    .bind(key.slice(0, 80), JSON.stringify(data))
    .run();
}

export async function getSeoSnapshot<T>(db: D1Database, key: string): Promise<{ data: T; updatedAt: string } | null> {
  const row = await db
    .prepare('SELECT value_json, updated_at FROM seo_snapshots WHERE key = ?1')
    .bind(key)
    .first<{ value_json: string; updated_at: string }>();
  if (!row) return null;
  try {
    return { data: JSON.parse(row.value_json) as T, updatedAt: row.updated_at };
  } catch {
    return null;
  }
}

export async function loadSeoDashboard(
  db: D1Database,
  opts: {
    siteUrl?: string;
    rangeDays?: number;
    statusFilter?: string;
    priorityFilter?: string;
    searchFilter?: string;
  } = {},
): Promise<SeoDashboardData> {
  const siteUrl = (opts.siteUrl || 'sc-domain:tqd.me').trim();
  const rangeDays = [7, 28, 90].includes(Number(opts.rangeDays)) ? Number(opts.rangeDays) : 28;
  const fromDay = getVnDayOffset(rangeDays - 1);
  const toDay = getVnDayOffset(0);

  const [totalsRow, groupedRes, keywordsRes, gscSnap, auditSnap] = await Promise.all([
    db
      .prepare(
        `SELECT
           COALESCE(SUM(clicks), 0) AS clicks,
           COALESCE(SUM(impressions), 0) AS impressions,
           COALESCE(SUM(position * impressions), 0) AS weighted_pos,
           COUNT(DISTINCT query) AS query_count,
           MAX(day) AS latest_day
         FROM seo_gsc_daily
         WHERE site = ?1 AND day >= ?2 AND day <= ?3`,
      )
      .bind(siteUrl, fromDay, toDay)
      .first<{
        clicks: number;
        impressions: number;
        weighted_pos: number;
        query_count: number;
        latest_day: string | null;
      }>(),
    db
      .prepare(
        `SELECT
           query,
           SUM(clicks) AS clicks,
           SUM(impressions) AS impressions,
           CASE WHEN SUM(impressions) > 0 THEN SUM(clicks) * 1.0 / SUM(impressions) ELSE 0 END AS ctr,
           CASE WHEN SUM(impressions) > 0 THEN SUM(position * impressions) * 1.0 / SUM(impressions) ELSE AVG(position) END AS position,
           MAX(page) AS top_page
         FROM seo_gsc_daily
         WHERE site = ?1 AND day >= ?2 AND day <= ?3
         GROUP BY query
         ORDER BY impressions DESC, clicks DESC
         LIMIT 250`,
      )
      .bind(siteUrl, fromDay, toDay)
      .all<{
        query: string;
        clicks: number;
        impressions: number;
        ctr: number;
        position: number;
        top_page: string;
      }>(),
    db
      .prepare(
        `SELECT
           k.id, k.keyword_norm, k.keyword, k.cluster, k.intent, k.priority, k.status,
           k.volume, k.difficulty, k.cpc, k.source, k.target_slug, k.suggested_title,
           k.notes, k.created_at, k.updated_at,
           a.id AS article_id, a.status AS article_status, a.title AS article_title
         FROM seo_keywords k
         LEFT JOIN articles a ON a.slug = k.target_slug
         ORDER BY
           CASE k.status WHEN 'planned' THEN 0 WHEN 'drafting' THEN 1 WHEN 'idea' THEN 2 WHEN 'published' THEN 3 ELSE 4 END,
           CASE k.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
           k.updated_at DESC, k.id DESC`,
      )
      .all<{
        id: number;
        keyword_norm: string;
        keyword: string;
        cluster: string;
        intent: string;
        priority: string;
        status: string;
        volume: number | null;
        difficulty: number | null;
        cpc: number | null;
        source: string;
        target_slug: string | null;
        suggested_title: string;
        notes: string;
        created_at: string;
        updated_at: string;
        article_id: number | null;
        article_status: string | null;
        article_title: string | null;
      }>(),
    getSeoSnapshot<GscSnapshotInfo>(db, 'gsc_status'),
    getSeoSnapshot<Record<string, unknown>>(db, 'seo_audit_latest'),
  ]);

  const totalClicks = Number(totalsRow?.clicks ?? 0);
  const totalImpressions = Number(totalsRow?.impressions ?? 0);
  const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
  const avgPos = totalImpressions > 0 ? Number(totalsRow?.weighted_pos ?? 0) / totalImpressions : 0;

  const grouped: GscQuerySummary[] = (groupedRes.results ?? []).map((r) => ({
    query: r.query,
    clicks: Number(r.clicks ?? 0),
    impressions: Number(r.impressions ?? 0),
    ctr: Number(r.ctr ?? 0),
    position: Math.round(Number(r.position ?? 0) * 10) / 10,
    topPage: r.top_page ?? '',
  }));

  const topQueries = [...grouped]
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
    .slice(0, 30);

  const lowCtrOpportunities: LowCtrOpportunity[] = grouped
    .filter((q) => q.position > 0 && q.position <= 20 && q.impressions >= 5 && q.ctr < 0.03)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 15)
    .map((q) => ({
      ...q,
      actionHint:
        q.position <= 10
          ? 'Đang ở trang 1 nhưng tỷ lệ bấm thấp: viết lại tiêu đề và mô tả bài viết hấp dẫn hơn.'
          : 'Đang ở trang 2 (vị trí 11–20): bổ sung đoạn giải đáp trực diện từ khóa và liên kết nội bộ.',
    }));

  const strikingDistance = grouped
    .filter((q) => q.position >= 7.5 && q.position <= 20.5 && q.impressions >= 3)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 15);

  const allKeywords: SeoKeywordRow[] = (keywordsRes.results ?? []).map((r) => {
    const inferredStatus: SeoStatus =
      r.article_status === 'published' && r.status !== 'archived'
        ? 'published'
        : r.article_status === 'draft' && (r.status === 'idea' || r.status === 'planned')
          ? 'drafting'
          : normalizeStatus(r.status);
    return {
      id: r.id,
      keywordNorm: r.keyword_norm,
      keyword: r.keyword,
      cluster: r.cluster ?? '',
      intent: normalizeIntent(r.intent),
      priority: normalizePriority(r.priority),
      status: inferredStatus,
      volume: r.volume ?? null,
      difficulty: r.difficulty ?? null,
      cpc: r.cpc ?? null,
      source: r.source ?? 'admin',
      targetSlug: r.target_slug ?? null,
      suggestedTitle: r.suggested_title ?? '',
      notes: r.notes ?? '',
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      articleId: r.article_id ?? null,
      articleStatus: r.article_status ?? null,
      articleTitle: r.article_title ?? null,
    };
  });

  const countsByStatus: Record<SeoStatus, number> = {
    idea: 0,
    planned: 0,
    drafting: 0,
    published: 0,
    archived: 0,
  };
  const clusterSet = new Set<string>();
  for (const kw of allKeywords) {
    countsByStatus[kw.status] += 1;
    if (kw.cluster) clusterSet.add(kw.cluster);
  }

  const sf = opts.statusFilter && opts.statusFilter !== 'all' ? opts.statusFilter : null;
  const pf = opts.priorityFilter && opts.priorityFilter !== 'all' ? opts.priorityFilter : null;
  const qf = opts.searchFilter ? normalizeKeywordKey(opts.searchFilter) : '';

  const filteredKeywords = allKeywords.filter((kw) => {
    if (sf && kw.status !== sf) return false;
    if (pf && kw.priority !== pf) return false;
    if (qf) {
      const hay = `${kw.keywordNorm} ${kw.cluster.toLowerCase()} ${(kw.suggestedTitle || '').toLowerCase()} ${(kw.targetSlug || '').toLowerCase()}`;
      if (!hay.includes(qf)) return false;
    }
    return true;
  });

  return {
    siteUrl,
    rangeDays,
    fromDay,
    toDay,
    gscTotals: {
      clicks: totalClicks,
      impressions: totalImpressions,
      ctr: avgCtr,
      avgPosition: Math.round(avgPos * 10) / 10,
      queryCount: Number(totalsRow?.query_count ?? 0),
      latestDay: totalsRow?.latest_day ?? null,
    },
    topQueries,
    lowCtrOpportunities,
    strikingDistance,
    keywords: filteredKeywords,
    totalKeywords: allKeywords.length,
    countsByStatus,
    clusters: [...clusterSet],
    gscSnapshot: gscSnap,
    auditSnapshot: auditSnap,
  };
}
