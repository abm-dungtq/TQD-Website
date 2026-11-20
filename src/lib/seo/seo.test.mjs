import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { getVnDayOffset } from '../analytics/wae-client';
import { saveArticle } from '../articles';
import {
  getNextDailyBrief,
  listDailyBriefQueue,
  prioritizeBrief,
  seedDailyBriefsAndKeywords,
  setBriefStatusBySlug,
  toggleBriefSkip,
} from './briefs';
import { DAILY_BRIEF_CATALOG, SEO_PILLARS } from './daily-catalog';
import { classifyVietnameseIntent, researchKeywords } from './keyword-research';
import { seedKeywordsFromQueue } from './queue-seed';
import {
  deleteSeoKeyword,
  loadSeoDashboard,
  normalizeKeywordKey,
  updateSeoKeyword,
  upsertGscDailyRows,
  upsertSeoKeywords,
} from './store';

function fakeD1(sqlite) {
  const wrapStmt = (sql, params = []) => ({
    bind: (...values) => wrapStmt(sql, values),
    first: async (colName) => {
      const row = sqlite.prepare(sql).get(...params);
      if (!row) return null;
      if (colName) return row[colName] ?? null;
      return row;
    },
    all: async () => ({
      results: sqlite.prepare(sql).all(...params),
      success: true,
      meta: {},
    }),
    run: async () => {
      const info = sqlite.prepare(sql).run(...params);
      return {
        results: [],
        success: true,
        meta: {
          changes: Number(info.changes ?? 0),
          last_row_id: Number(info.lastInsertRowid ?? 0),
        },
      };
    },
  });

  return {
    prepare: (sql) => wrapStmt(sql),
    batch: async (list) => Promise.all(list.map((s) => s.all())),
  };
}

let sqlite;
let db;

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync('migrations/0001_init.sql', 'utf8'));
  sqlite.exec(readFileSync('migrations/0007_seo_hub.sql', 'utf8'));
  sqlite.exec(readFileSync('migrations/0008_seo_daily_briefs.sql', 'utf8'));
  db = fakeD1(sqlite);
});

describe('SEO helper utilities & Vietnamese intent classifier', () => {
  it('normalizes whitespace, case, and Unicode NFC for Vietnamese keywords', () => {
    expect(normalizeKeywordKey('  AI   Agent  cho   doanh nghiệp  ')).toBe('ai agent cho doanh nghiệp');
    const decomposed = 'AI Agent tie\u0302\u0301ng Vie\u0323\u0302t'.normalize('NFD');
    expect(normalizeKeywordKey(decomposed)).toBe('ai agent tiếng việt');
  });

  it('classifies Vietnamese search intent accurately across diacritic-heavy phrases', () => {
    expect(classifyVietnameseIntent('AI Agent là gì')).toBe('informational');
    expect(classifyVietnameseIntent('so sánh Claude và ChatGPT cho CEO')).toBe('commercial');
    expect(classifyVietnameseIntent('công cụ tải video TikTok không logo miễn phí')).toBe('transactional');
    expect(classifyVietnameseIntent('mua tài khoản Veo 3 Ultra')).toBe('transactional');
    expect(classifyVietnameseIntent('Trịnh Quang Dũng AI')).toBe('navigational');
  });
});

describe('D1 SEO store, GSC aggregation, and backlog seeding', () => {
  it('upserts, updates, deletes keywords and infers published status when linked article exists', async () => {
    await db
      .prepare(
        `INSERT INTO articles (slug, title, summary, body_md, body_html, status)
         VALUES ('ai-agent-khac-gi-chatbot', 'AI Agent khác gì Chatbot', 'Tóm tắt', 'Nội dung', '<p>Nội dung</p>', 'published')`,
      )
      .run();

    const n = await upsertSeoKeywords(db, [
      {
        keyword: 'AI Agent khác gì Chatbot',
        cluster: 'Chặng 1',
        intent: 'commercial',
        priority: 'high',
        status: 'planned',
        targetSlug: 'ai-agent-khac-gi-chatbot',
      },
      {
        keyword: 'ai agent khác gì chatbot',
        cluster: 'Ignored dup',
      },
      {
        keyword: 'tự động hóa báo cáo bằng AI',
        cluster: 'Chặng 2',
        priority: 'medium',
        status: 'idea',
      },
    ]);
    expect(n).toBe(2);

    const dash = await loadSeoDashboard(db);
    expect(dash.totalKeywords).toBe(2);
    const linked = dash.keywords.find((k) => k.targetSlug === 'ai-agent-khac-gi-chatbot');
    expect(linked?.status).toBe('published');
    expect(typeof linked?.articleId).toBe('number');

    const second = dash.keywords.find((k) => k.keywordNorm === 'tự động hóa báo cáo bằng ai');
    const updated = await updateSeoKeyword(db, second.id, { status: 'planned', priority: 'high' });
    expect(updated).toBe(true);

    const deleted = await deleteSeoKeyword(db, second.id);
    expect(deleted).toBe(true);
    const dashAfter = await loadSeoDashboard(db);
    expect(dashAfter.totalKeywords).toBe(1);
  });

  it('aggregates GSC daily metrics, low-CTR quick wins, and striking-distance queries accurately', async () => {
    const today = getVnDayOffset(0);
    const yesterday = getVnDayOffset(1);

    const count = await upsertGscDailyRows(db, 'sc-domain:tqd.me', [
      {
        day: today,
        query: 'tải video tiktok không logo',
        page: 'https://tqd.me/tai-video',
        clicks: 2,
        impressions: 200,
        ctr: 0.01,
        position: 8.4,
      },
      {
        day: yesterday,
        query: 'tải video tiktok không logo',
        page: 'https://tqd.me/tai-video',
        clicks: 1,
        impressions: 100,
        ctr: 0.01,
        position: 9.0,
      },
      {
        day: today,
        query: 'ai agent cho doanh nghiệp nhỏ',
        page: 'https://tqd.me/bai-viet/ai-agent-khac-gi-chatbot',
        clicks: 0,
        impressions: 50,
        ctr: 0,
        position: 14.2,
      },
      {
        day: today,
        query: 'dũngtq',
        page: 'https://tqd.me/',
        clicks: 25,
        impressions: 40,
        ctr: 0.625,
        position: 1.2,
      },
    ]);
    expect(count).toBe(4);

    const dash = await loadSeoDashboard(db, { siteUrl: 'sc-domain:tqd.me', rangeDays: 28 });
    expect(dash.gscTotals.clicks).toBe(28);
    expect(dash.gscTotals.impressions).toBe(390);
    expect(dash.gscTotals.queryCount).toBe(3);

    expect(dash.lowCtrOpportunities.some((q) => q.query === 'tải video tiktok không logo')).toBe(true);
    expect(dash.lowCtrOpportunities.some((q) => q.query === 'ai agent cho doanh nghiệp nhỏ')).toBe(true);
    expect(dash.lowCtrOpportunities.some((q) => q.query === 'dũngtq')).toBe(false);

    expect(dash.strikingDistance.map((q) => q.query)).toContain('tải video tiktok không logo');
    expect(dash.strikingDistance.map((q) => q.query)).toContain('ai agent cho doanh nghiệp nhỏ');
  });

  it('seeds keywords idempotently from plans/seo-aeo-queue.json', async () => {
    const first = await seedKeywordsFromQueue(db);
    const second = await seedKeywordsFromQueue(db);
    expect(first).toBeGreaterThanOrEqual(45);
    expect(second).toBe(first);

    const dash = await loadSeoDashboard(db);
    expect(dash.totalKeywords).toBe(first);
  });
});

describe('researchKeywords (/ak-seo Keyword Lab)', () => {
  it('merges Google Suggest VN, leaves ReviewWeb metrics null when API key is missing, and detects site coverage', async () => {
    await db
      .prepare(
        `INSERT INTO articles (slug, title, summary, body_md, body_html, status, tags)
         VALUES ('ai-agent-la-gi', 'AI Agent là gì cho người mới bắt đầu', 'Tóm tắt', 'Nội dung', '<p>Nội dung</p>', 'published', '["AI Agent"]')`,
      )
      .run();

    const mockFetch = async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('suggestqueries.google.com')) {
        return new Response(
          JSON.stringify([
            'ai agent',
            ['ai agent là gì', 'cách tạo ai agent không cần code', 'tải video tiktok không logo miễn phí'],
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      throw new Error(`Unexpected fetch ${url}`);
    };

    const res = await researchKeywords(db, 'ai agent', { fetchImpl: mockFetch });
    expect(res.reviewWebConnected).toBe(false);
    expect(res.sourcesUsed).toContain('Google Suggest VN (hl=vi, gl=vn)');

    const coveredArticle = res.items.find((i) => i.keywordNorm === 'ai agent là gì');
    expect(coveredArticle?.coverage).toBe('covered_article');
    expect(coveredArticle?.matchedArticle?.slug).toBe('ai-agent-la-gi');
    expect(coveredArticle?.volume).toBeNull();
    expect(coveredArticle?.difficulty).toBeNull();

    const coveredTool = res.items.find((i) => i.keywordNorm === 'tải video tiktok không logo miễn phí');
    expect(coveredTool?.coverage).toBe('covered_tool');
    expect(coveredTool?.matchedToolPath).toBe('/tai-video');

    const newOpp = res.items.find((i) => i.keywordNorm === 'cách tạo ai agent không cần code');
    expect(newOpp?.coverage).toBe('new_opportunity');
    expect(newOpp?.suggestedSlug).toBe('cach-tao-ai-agent-khong-can-code');
  });

  it('enriches volume, difficulty, and cpc when REVIEWWEB_API_KEY is configured', async () => {
    const mockFetch = async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('suggestqueries.google.com')) {
        return new Response(JSON.stringify(['ai agent', ['ai agent vietnam']]), { status: 200 });
      }
      if (url.includes('reviewweb.site')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: [{ keyword: 'ai agent vietnam', volume: 1900, difficulty: 28, cpc: 0.45 }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      throw new Error(`Unexpected fetch ${url}`);
    };

    const res = await researchKeywords(db, 'ai agent', {
      reviewWebApiKey: 'rw_test_key',
      fetchImpl: mockFetch,
    });
    expect(res.reviewWebConnected).toBe(true);
    const enriched = res.items.find((i) => i.keywordNorm === 'ai agent vietnam');
    expect(enriched?.volume).toBe(1900);
    expect(enriched?.difficulty).toBe(28);
    expect(enriched?.cpc).toBe(0.45);
    expect(enriched?.sources).toContain('ReviewWeb');
  });

  it('drops off-brand forum/crypto Google Suggest noise automatically', async () => {
    const mockFetch = async () =>
      new Response(
        JSON.stringify([
          'ai agent',
          ['ai agent là gì', 'ai agent là gì voz', 'ai agent là gì trong crypto', 'ai agent cho doanh nghiệp'],
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );

    const res = await researchKeywords(db, 'ai agent', { fetchImpl: mockFetch });
    const kws = res.items.map((i) => i.keywordNorm);
    expect(kws).toContain('ai agent là gì');
    expect(kws).toContain('ai agent cho doanh nghiệp');
    expect(kws).not.toContain('ai agent là gì voz');
    expect(kws).not.toContain('ai agent là gì trong crypto');
  });
});

describe('Daily SEO + GEO Brief Catalog & Agent Queue', () => {
  it('validates all catalog briefs have unique slugs, >= 4 keywords, clean Vietnamese headings, and zero banned phrases', () => {
    expect(DAILY_BRIEF_CATALOG.length).toBeGreaterThanOrEqual(40);
    const seenSlugs = new Set();
    const banned = ['opus video', 'opus-video', 'tqd-clean your mac', 'tqd-clean-your-mac', 'viet-pro-codex', 'trần quốc dũng'];

    for (const brief of DAILY_BRIEF_CATALOG) {
      expect(SEO_PILLARS).toContain(brief.pillar);
      expect(brief.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(seenSlugs.has(brief.slug)).toBe(false);
      seenSlugs.add(brief.slug);

      expect(brief.primaryKeyword.length).toBeGreaterThan(2);
      expect(brief.secondaryKeywords.length).toBeGreaterThanOrEqual(3);
      expect(brief.sections).toHaveLength(5);
      expect(brief.title.includes(':')).toBe(false);
      expect(/[—–]/.test(brief.title)).toBe(false);

      for (const h2 of brief.sections) {
        expect(h2.includes(':')).toBe(false);
        expect(/[—–]/.test(h2)).toBe(false);
      }

      const fullText = JSON.stringify(brief).toLowerCase();
      for (const b of banned) {
        expect(fullText.includes(b)).toBe(false);
      }
    }
  });

  it('seeds queue, resolves live internal links, claims atomically, and auto-completes on article publish', async () => {
    // Seed initial published article & settings content_version row required by saveArticle()
    await db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('content_version', '1')").run();
    await db
      .prepare(
        `INSERT INTO articles (slug, title, summary, body_md, body_html, status)
         VALUES ('tu-dien-ai-agent-cho-nguoi-khong-biet-lap-trinh', 'Từ điển AI và AI Agent', 'Tóm tắt', 'Nội dung', '<p>Nội dung</p>', 'published')`,
      )
      .run();

    const seeded = await seedDailyBriefsAndKeywords(db);
    expect(seeded.briefsSeeded).toBe(DAILY_BRIEF_CATALOG.length);

    const queueBefore = await listDailyBriefQueue(db);
    expect(queueBefore.counts.queued).toBe(DAILY_BRIEF_CATALOG.length);

    // Peek without claiming
    const peek = await getNextDailyBrief(db);
    expect(peek?.status).toBe('queued');
    expect(peek?.liveInternalLinks.some((l) => l.slug === 'tu-dien-ai-agent-cho-nguoi-khong-biet-lap-trinh')).toBe(true);
    expect(peek?.author.name).toBe('Trịnh Quang Dũng (DũngTQ)');

    // Claim atomically
    const claimed = await getNextDailyBrief(db, { claimBy: 'agy' });
    expect(claimed?.slug).toBe(peek?.slug);
    expect(claimed?.status).toBe('writing');
    expect(claimed?.claimedBy).toBe('agy');

    // Next peek should move on to the second brief
    const secondPeek = await getNextDailyBrief(db);
    expect(secondPeek?.slug).not.toBe(claimed?.slug);

    // Release back to queued, prioritize second brief, toggle skip, and restore
    expect(await setBriefStatusBySlug(db, claimed.slug, 'release')).toBe(true);
    expect(await prioritizeBrief(db, secondPeek.id)).toBe(true);
    const prioritized = await getNextDailyBrief(db);
    expect(prioritized?.slug).toBe(secondPeek?.slug);

    expect(await toggleBriefSkip(db, secondPeek.id)).toBe(true);
    const afterSkip = await getNextDailyBrief(db);
    expect(afterSkip?.slug).toBe(claimed?.slug);

    // Publishing the article via saveArticle marks the brief and target keywords as published
    await saveArticle(
      db,
      {
        slug: claimed.slug,
        title: claimed.title,
        summary: 'Tóm tắt bài viết chuẩn SEO GEO trên tqd.me.',
        bodyMd: 'Nội dung mở đầu chuẩn Answer Capsule.',
        tags: ['AI Agent'],
        status: 'published',
      },
      { source: 'agent:agy' },
    );

    const queueAfter = await listDailyBriefQueue(db);
    const doneBrief = queueAfter.items.find((i) => i.slug === claimed.slug);
    expect(doneBrief?.status).toBe('published');
  });
});
