import { slugify } from '../articles';
import {
  DAILY_BRIEF_CATALOG,
  PILLAR_DEFAULT_CTA,
  PILLAR_LABELS,
  SEO_PILLARS,
  type SeoPillar,
} from './daily-catalog';
import { classifyVietnameseIntent } from './keyword-research';
import { seedKeywordsFromQueue } from './queue-seed';
import { type SeoKeywordInput, upsertSeoKeywords } from './store';

export const BRIEF_STATUSES = ['queued', 'writing', 'published', 'skipped'] as const;
export type BriefStatus = (typeof BRIEF_STATUSES)[number];

export interface DailyBriefRow {
  id: number;
  dayOrder: number;
  pillar: SeoPillar;
  pillarLabel: string;
  slug: string;
  title: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  geoQuestions: string[];
  answerCapsuleHint: string;
  sections: string[];
  tableSpec: string;
  eeatAnchor: string;
  internalLinks: Array<{ slug: string; anchor: string }>;
  ctaPath: string;
  analogy: string;
  fbAngle: string;
  status: BriefStatus;
  claimedBy: string | null;
  claimedAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

export interface ResolvedDailyBrief extends DailyBriefRow {
  liveInternalLinks: Array<{ slug: string; url: string; title: string; anchor: string }>;
  plannedInternalLinks: Array<{ slug: string; anchor: string }>;
  liveSectionLinks: Array<{ path: string; note: string }>;
  author: {
    name: string;
    brand: string;
    pronounsWebsite: string;
    pronounsFacebook: string;
    zalo: string;
  };
  geoChecklist: string[];
}

export interface BriefQueueSummary {
  counts: Record<BriefStatus, number> & { total: number };
  byPillar: Record<SeoPillar, { queued: number; writing: number; published: number; skipped: number }>;
  nextBrief: DailyBriefRow | null;
  items: DailyBriefRow[];
}

export function normalizePillar(raw: unknown, fallback: SeoPillar = 'ai-agent-sme'): SeoPillar {
  return SEO_PILLARS.includes(raw as SeoPillar) ? (raw as SeoPillar) : fallback;
}

function parseJsonArray<T>(raw: string | null | undefined, fallback: T[] = []): T[] {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function mapBriefRow(r: {
  id: number;
  day_order: number;
  pillar: string;
  slug: string;
  title: string;
  primary_keyword: string;
  secondary_keywords_json: string;
  geo_questions_json: string;
  answer_capsule_hint: string;
  sections_json: string;
  table_spec: string;
  eeat_anchor: string;
  internal_links_json: string;
  cta_path: string;
  analogy: string;
  fb_angle: string;
  status: string;
  claimed_by: string | null;
  claimed_at: string | null;
  published_at: string | null;
  updated_at: string;
}): DailyBriefRow {
  const pillar = normalizePillar(r.pillar);
  const status = BRIEF_STATUSES.includes(r.status as BriefStatus) ? (r.status as BriefStatus) : 'queued';
  return {
    id: r.id,
    dayOrder: r.day_order,
    pillar,
    pillarLabel: PILLAR_LABELS[pillar],
    slug: r.slug,
    title: r.title,
    primaryKeyword: r.primary_keyword,
    secondaryKeywords: parseJsonArray<string>(r.secondary_keywords_json),
    geoQuestions: parseJsonArray<string>(r.geo_questions_json),
    answerCapsuleHint: r.answer_capsule_hint ?? '',
    sections: parseJsonArray<string>(r.sections_json),
    tableSpec: r.table_spec ?? '',
    eeatAnchor: r.eeat_anchor ?? '',
    internalLinks: parseJsonArray<{ slug: string; anchor: string }>(r.internal_links_json),
    ctaPath: r.cta_path || PILLAR_DEFAULT_CTA[pillar],
    analogy: r.analogy ?? '',
    fbAngle: r.fb_angle ?? '',
    status,
    claimedBy: r.claimed_by ?? null,
    claimedAt: r.claimed_at ?? null,
    publishedAt: r.published_at ?? null,
    updatedAt: r.updated_at,
  };
}

/** Syncs `seo_daily_briefs` status with live published articles so agents never re-pick published slugs. */
export async function reconcileBriefsWithArticles(db: D1Database): Promise<void> {
  await db
    .prepare(
      `UPDATE seo_daily_briefs
       SET status = 'published',
           published_at = COALESCE(published_at, datetime('now')),
           updated_at = datetime('now')
       WHERE status IN ('queued', 'writing')
         AND slug IN (SELECT slug FROM articles WHERE status = 'published')`,
    )
    .run()
    .catch(() => {});

  // Release stale writing claims older than 6 hours so crashed runs don't block the queue.
  await db
    .prepare(
      `UPDATE seo_daily_briefs
       SET status = 'queued', claimed_by = NULL, claimed_at = NULL, updated_at = datetime('now')
       WHERE status = 'writing'
         AND claimed_at IS NOT NULL
         AND claimed_at < datetime('now', '-6 hours')`,
    )
    .run()
    .catch(() => {});
}

/** Seeds all 45 multi-pillar daily briefs + their mapped keywords idempotently into D1. */
export async function seedDailyBriefsAndKeywords(
  db: D1Database,
): Promise<{ briefsSeeded: number; keywordsSeeded: number }> {
  const articlesRes = await db
    .prepare('SELECT slug, status FROM articles')
    .all<{ slug: string; status: string }>()
    .catch(() => ({ results: [] as Array<{ slug: string; status: string }> }));

  const articleStatusBySlug = new Map<string, string>();
  for (const row of articlesRes.results ?? []) {
    articleStatusBySlug.set(row.slug, row.status);
  }

  const upsertSql = `
    INSERT INTO seo_daily_briefs (
      day_order, pillar, slug, title, primary_keyword, secondary_keywords_json,
      geo_questions_json, answer_capsule_hint, sections_json, table_spec, eeat_anchor,
      internal_links_json, cta_path, analogy, fb_angle, status, published_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, CASE WHEN ?16 = 'published' THEN datetime('now') ELSE NULL END)
    ON CONFLICT(slug) DO UPDATE SET
      day_order = CASE WHEN seo_daily_briefs.status = 'queued' THEN excluded.day_order ELSE seo_daily_briefs.day_order END,
      pillar = excluded.pillar,
      title = excluded.title,
      primary_keyword = excluded.primary_keyword,
      secondary_keywords_json = excluded.secondary_keywords_json,
      geo_questions_json = excluded.geo_questions_json,
      answer_capsule_hint = excluded.answer_capsule_hint,
      sections_json = excluded.sections_json,
      table_spec = excluded.table_spec,
      eeat_anchor = excluded.eeat_anchor,
      internal_links_json = excluded.internal_links_json,
      cta_path = excluded.cta_path,
      analogy = excluded.analogy,
      fb_angle = excluded.fb_angle,
      status = CASE WHEN excluded.status = 'published' THEN 'published' ELSE seo_daily_briefs.status END,
      published_at = COALESCE(seo_daily_briefs.published_at, excluded.published_at),
      updated_at = datetime('now')
  `;

  const stmts: D1PreparedStatement[] = [];
  const keywordInputs: SeoKeywordInput[] = [];

  for (const item of DAILY_BRIEF_CATALOG) {
    const artStatus = articleStatusBySlug.get(item.slug);
    const briefStatus: BriefStatus = artStatus === 'published' ? 'published' : 'queued';
    const kwStatus =
      artStatus === 'published' ? 'published' : artStatus === 'draft' ? 'drafting' : 'planned';

    stmts.push(
      db
        .prepare(upsertSql)
        .bind(
          item.dayOrder,
          item.pillar,
          item.slug,
          item.title,
          item.primaryKeyword,
          JSON.stringify(item.secondaryKeywords),
          JSON.stringify(item.geoQuestions),
          item.answerCapsuleHint,
          JSON.stringify(item.sections),
          item.tableSpec,
          item.eeatAnchor,
          JSON.stringify(item.internalLinks),
          item.ctaPath,
          item.analogy,
          item.fbAngle,
          briefStatus,
        ),
    );

    const clusterLabel = PILLAR_LABELS[item.pillar];
    keywordInputs.push({
      keyword: item.primaryKeyword,
      cluster: clusterLabel,
      intent: classifyVietnameseIntent(item.primaryKeyword),
      priority: 'high',
      status: kwStatus,
      source: 'seo-daily-catalog',
      targetSlug: item.slug,
      suggestedTitle: item.title,
      notes: item.answerCapsuleHint,
    });

    for (const secKw of item.secondaryKeywords) {
      keywordInputs.push({
        keyword: secKw,
        cluster: clusterLabel,
        intent: classifyVietnameseIntent(secKw),
        priority: 'medium',
        status: kwStatus,
        source: 'seo-daily-catalog',
        targetSlug: item.slug,
        suggestedTitle: item.title,
        notes: item.analogy,
      });
    }
  }

  for (let i = 0; i < stmts.length; i += 25) {
    await db.batch(stmts.slice(i, i + 25));
  }

  // Purge any noisy forum/crypto suggest terms if still unworked
  await db
    .prepare(
      `DELETE FROM seo_keywords
       WHERE status = 'planned'
         AND source IN ('google-suggest-vn', 'keyword-lab')
         AND (
           keyword_norm LIKE '% voz%'
           OR keyword_norm LIKE '% viblo%'
           OR keyword_norm LIKE '%crypto%'
           OR keyword_norm LIKE '%github%'
         )`,
    )
    .run()
    .catch(() => {});

  const queueKwCount = await seedKeywordsFromQueue(db);
  const catalogKwCount = await upsertSeoKeywords(db, keywordInputs);

  return {
    briefsSeeded: DAILY_BRIEF_CATALOG.length,
    keywordsSeeded: Math.max(queueKwCount, catalogKwCount) > 0 ? catalogKwCount + queueKwCount : 0,
  };
}

/** Resolves a DailyBriefRow into a ready-to-write Agent brief with verified live 200 internal links. */
export async function resolveBriefForAgent(
  db: D1Database,
  row: DailyBriefRow,
): Promise<ResolvedDailyBrief> {
  const pubRes = await db
    .prepare("SELECT slug, title FROM articles WHERE status = 'published'")
    .all<{ slug: string; title: string }>()
    .catch(() => ({ results: [] as Array<{ slug: string; title: string }> }));

  const pubMap = new Map<string, string>();
  for (const p of pubRes.results ?? []) {
    pubMap.set(p.slug, p.title);
  }

  const liveInternalLinks: ResolvedDailyBrief['liveInternalLinks'] = [];
  const plannedInternalLinks: ResolvedDailyBrief['plannedInternalLinks'] = [];

  for (const link of row.internalLinks) {
    const liveTitle = pubMap.get(link.slug);
    if (liveTitle) {
      liveInternalLinks.push({
        slug: link.slug,
        url: `/bai-viet/${link.slug}`,
        title: liveTitle,
        anchor: link.anchor,
      });
    } else {
      plannedInternalLinks.push(link);
    }
  }

  // Always guarantee at least 1 live internal link if Pillar Hub exists on site.
  const hubSlug = 'tu-dien-ai-agent-cho-nguoi-khong-biet-lap-trinh';
  const hubTitle = pubMap.get(hubSlug);
  if (hubTitle && !liveInternalLinks.some((l) => l.slug === hubSlug)) {
    liveInternalLinks.push({
      slug: hubSlug,
      url: `/bai-viet/${hubSlug}`,
      title: hubTitle,
      anchor: 'từ điển AI và AI Agent cho người không biết lập trình',
    });
  }

  const ctaLabels: Record<string, string> = {
    '/shop': 'Cửa hàng công cụ AI & tài khoản Veo 3 / Google AI Ultra',
    '/tai-video': 'Công cụ tải video & Xưởng phân tích kịch bản viral AI',
    '/san-pham': 'Danh mục sản phẩm AI, Skill và mã nguồn mở của DũngTQ',
    '/ho-so': 'Hồ sơ chuyên gia & đặt lịch đào tạo AI doanh nghiệp (ABM)',
  };

  const liveSectionLinks: ResolvedDailyBrief['liveSectionLinks'] = [
    { path: row.ctaPath, note: ctaLabels[row.ctaPath] || 'Trang đích chuyển đổi chính của bài viết' },
  ];
  if (row.ctaPath !== '/ho-so') {
    liveSectionLinks.push({ path: '/ho-so', note: ctaLabels['/ho-so'] });
  }

  return {
    ...row,
    liveInternalLinks,
    plannedInternalLinks,
    liveSectionLinks,
    author: {
      name: 'Trịnh Quang Dũng (DũngTQ)',
      brand: 'ABM',
      pronounsWebsite: 'mình - bạn',
      pronounsFacebook: 'mình - anh em',
      zalo: 'https://zalo.me/trinhquangdung',
    },
    geoChecklist: [
      'Không viết thẻ # H1 trong bodyMd (template trang đã tự hiển thị title làm H1).',
      'Mở đầu bằng Answer Capsule 40–60 từ chứa từ khóa chính, trả lời thẳng câu hỏi trung tâm, không dùng đại từ mơ hồ.',
      'Dùng đúng 5 tiêu đề ## H2 từ trường sections (sentence case, không chứa dấu hai chấm :, không gạch ngang dài).',
      'Chèn ít nhất 1 bảng so sánh Markdown (viết gọn |Cột 1|Cột 2|, không khoảng trắng thừa hai bên dấu |) theo tableSpec.',
      'Lồng tự nhiên điểm tựa thực chứng eeatAnchor mang tên Trịnh Quang Dũng (DũngTQ) / ABM vào thân bài để khối RAG giữ nguyên nguồn tác giả.',
      'Chỉ gắn link nội bộ từ liveInternalLinks và liveSectionLinks (tuyệt đối không gắn link bài chưa đăng ở plannedInternalLinks).',
      'Không chèn lại ảnh bìa (--cover) vào trong bodyMd; chạy viet-pro gate trước khi xuất bản.',
    ],
  };
}

/** Fetches (and optionally claims atomically) the next queued SEO+GEO daily brief. */
export async function getNextDailyBrief(
  db: D1Database,
  opts: { pillar?: string; claimBy?: string } = {},
): Promise<ResolvedDailyBrief | null> {
  await reconcileBriefsWithArticles(db);

  const filterPillar = opts.pillar && SEO_PILLARS.includes(opts.pillar as SeoPillar) ? opts.pillar : null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const stmt = filterPillar
      ? db
          .prepare(
            `SELECT * FROM seo_daily_briefs
             WHERE status = 'queued' AND pillar = ?1
             ORDER BY day_order ASC, id ASC LIMIT 1`,
          )
          .bind(filterPillar)
      : db.prepare(
          `SELECT * FROM seo_daily_briefs
           WHERE status = 'queued'
           ORDER BY day_order ASC, id ASC LIMIT 1`,
        );

    const raw = await stmt.first<Parameters<typeof mapBriefRow>[0]>();
    if (!raw) return null;

    if (!opts.claimBy) {
      return resolveBriefForAgent(db, mapBriefRow(raw));
    }

    const claimRes = await db
      .prepare(
        `UPDATE seo_daily_briefs
         SET status = 'writing',
             claimed_by = ?1,
             claimed_at = datetime('now'),
             updated_at = datetime('now')
         WHERE id = ?2 AND status = 'queued'`,
      )
      .bind(opts.claimBy.slice(0, 60), raw.id)
      .run();

    if ((claimRes.meta?.changes ?? 0) > 0) {
      const updated = await db
        .prepare('SELECT * FROM seo_daily_briefs WHERE id = ?1')
        .bind(raw.id)
        .first<Parameters<typeof mapBriefRow>[0]>();
      return resolveBriefForAgent(db, mapBriefRow(updated ?? raw));
    }
  }

  return null;
}

export async function listDailyBriefQueue(
  db: D1Database,
  opts: { pillar?: string; status?: string } = {},
): Promise<BriefQueueSummary> {
  await reconcileBriefsWithArticles(db);

  const allRes = await db
    .prepare(
      `SELECT * FROM seo_daily_briefs
       ORDER BY
         CASE status WHEN 'writing' THEN 0 WHEN 'queued' THEN 1 WHEN 'skipped' THEN 2 ELSE 3 END,
         day_order ASC, id ASC`,
    )
    .all<Parameters<typeof mapBriefRow>[0]>();

  const allItems = (allRes.results ?? []).map(mapBriefRow);
  const counts: Record<BriefStatus, number> & { total: number } = {
    queued: 0,
    writing: 0,
    published: 0,
    skipped: 0,
    total: allItems.length,
  };
  const byPillar: BriefQueueSummary['byPillar'] = {
    'ai-agent-sme': { queued: 0, writing: 0, published: 0, skipped: 0 },
    'cua-hang-ai-roi': { queued: 0, writing: 0, published: 0, skipped: 0 },
    'xuong-video-viral': { queued: 0, writing: 0, published: 0, skipped: 0 },
    'vibe-code-cloudflare': { queued: 0, writing: 0, published: 0, skipped: 0 },
    'viet-pro-geo-ax': { queued: 0, writing: 0, published: 0, skipped: 0 },
  };

  for (const item of allItems) {
    counts[item.status] += 1;
    byPillar[item.pillar][item.status] += 1;
  }

  const nextBrief =
    allItems
      .filter((i) => i.status === 'queued')
      .sort((a, b) => a.dayOrder - b.dayOrder || a.id - b.id)[0] ?? null;

  const pf = opts.pillar && opts.pillar !== 'all' ? opts.pillar : null;
  const sf = opts.status && opts.status !== 'all' ? opts.status : null;
  const filtered = allItems.filter((i) => (!pf || i.pillar === pf) && (!sf || i.status === sf));

  return {
    counts,
    byPillar,
    nextBrief,
    items: filtered,
  };
}

export async function prioritizeBrief(db: D1Database, id: number): Promise<boolean> {
  if (!Number.isInteger(id) || id <= 0) return false;
  const minRow = await db
    .prepare("SELECT MIN(day_order) AS min_order FROM seo_daily_briefs WHERE status = 'queued'")
    .first<{ min_order: number | null }>();
  const nextOrder = (minRow?.min_order ?? 1) - 1;
  const res = await db
    .prepare(
      `UPDATE seo_daily_briefs
       SET day_order = ?1, status = 'queued', claimed_by = NULL, claimed_at = NULL, updated_at = datetime('now')
       WHERE id = ?2 AND status != 'published'`,
    )
    .bind(nextOrder, id)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

export async function toggleBriefSkip(db: D1Database, id: number): Promise<boolean> {
  if (!Number.isInteger(id) || id <= 0) return false;
  const row = await db
    .prepare('SELECT id, status FROM seo_daily_briefs WHERE id = ?1')
    .bind(id)
    .first<{ id: number; status: string }>();
  if (!row || row.status === 'published') return false;
  const nextStatus = row.status === 'skipped' ? 'queued' : 'skipped';
  const res = await db
    .prepare(
      `UPDATE seo_daily_briefs
       SET status = ?1, claimed_by = NULL, claimed_at = NULL, updated_at = datetime('now')
       WHERE id = ?2`,
    )
    .bind(nextStatus, id)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

export async function setBriefStatusBySlug(
  db: D1Database,
  slug: string,
  action: 'release' | 'skip' | 'queue',
): Promise<boolean> {
  const nextStatus: BriefStatus = action === 'skip' ? 'skipped' : 'queued';
  const res = await db
    .prepare(
      `UPDATE seo_daily_briefs
       SET status = ?1, claimed_by = NULL, claimed_at = NULL, updated_at = datetime('now')
       WHERE slug = ?2 AND status != 'published'`,
    )
    .bind(nextStatus, slug)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

export async function createBriefFromKeyword(
  db: D1Database,
  input: { keyword: string; pillar?: SeoPillar; slug?: string; title?: string },
): Promise<string> {
  const kw = input.keyword.normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, 160);
  const pillar = normalizePillar(input.pillar, 'ai-agent-sme');
  const cleanSlug = (input.slug ? slugify(input.slug) : '') || slugify(kw) || `bai-viet-${Date.now()}`;
  const cleanTitle = (input.title || kw).trim().slice(0, 200);

  const minRow = await db
    .prepare("SELECT MIN(day_order) AS min_order FROM seo_daily_briefs WHERE status = 'queued'")
    .first<{ min_order: number | null }>();
  const dayOrder = (minRow?.min_order ?? 1) - 1;

  const sections = [
    `Vì sao nhiều người gặp vướng mắc với ${kw}`,
    `${kw} hoạt động như thế nào trong thực tế`,
    `Cách triển khai ${kw} từng bước cho người không chuyên`,
    `Bảng đối chiếu các lựa chọn phổ biến hiện nay`,
    `Những lưu ý an toàn và sai lầm cần tránh`,
  ];

  await db
    .prepare(
      `INSERT INTO seo_daily_briefs (
        day_order, pillar, slug, title, primary_keyword, secondary_keywords_json,
        geo_questions_json, answer_capsule_hint, sections_json, table_spec, eeat_anchor,
        internal_links_json, cta_path, analogy, fb_angle, status
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, 'queued')
      ON CONFLICT(slug) DO UPDATE SET
        day_order = excluded.day_order,
        pillar = excluded.pillar,
        title = excluded.title,
        primary_keyword = excluded.primary_keyword,
        status = CASE WHEN seo_daily_briefs.status = 'published' THEN 'published' ELSE 'queued' END,
        updated_at = datetime('now')`,
    )
    .bind(
      dayOrder,
      pillar,
      cleanSlug,
      cleanTitle,
      kw,
      JSON.stringify([`${kw} là gì`, `cách dùng ${kw}`, `${kw} cho doanh nghiệp`]),
      JSON.stringify([`${kw} giải quyết vấn đề gì và phù hợp với ai?`]),
      `Trả lời trực diện khái niệm và giá trị cốt lõi của ${kw} trong 40–60 từ ngay đầu bài.`,
      JSON.stringify(sections),
      `Bảng so sánh cách làm thủ công và áp dụng ${kw} theo 4 tiêu chí cụ thể.`,
      'Chia sẻ từ kinh nghiệm triển khai thực tế tại ABM của Trịnh Quang Dũng (DũngTQ).',
      JSON.stringify([
        { slug: 'tu-dien-ai-agent-cho-nguoi-khong-biet-lap-trinh', anchor: 'từ điển AI và AI Agent cho người không biết lập trình' },
        { slug: 'ai-agent-khac-gi-chatbot', anchor: 'phân biệt Chatbot thông thường và AI Agent' },
      ]),
      PILLAR_DEFAULT_CTA[pillar],
      `Ví dụ ẩn dụ đời thường giúp người mới hiểu ngay bản chất của ${kw}.`,
      `Góc nhìn thực tế hài hước về sai lầm thường gặp khi làm ${kw} theo thói quen cũ.`,
    )
    .run();

  await upsertSeoKeywords(db, [
    {
      keyword: kw,
      cluster: PILLAR_LABELS[pillar],
      intent: classifyVietnameseIntent(kw),
      priority: 'high',
      status: 'planned',
      source: 'keyword-lab-brief',
      targetSlug: cleanSlug,
      suggestedTitle: cleanTitle,
    },
  ]);

  return cleanSlug;
}
