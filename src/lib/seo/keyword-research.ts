import { slugify } from '../articles';
import {
  normalizeKeywordKey,
  type SeoIntent,
  type SeoPriority,
  type SeoStatus,
} from './store';

export interface ReviewWebIdea {
  keyword: string;
  volume: number | null;
  difficulty: number | null;
  cpc: number | null;
}

export interface ResearchedKeywordItem {
  keyword: string;
  keywordNorm: string;
  intent: SeoIntent;
  priority: SeoPriority;
  sources: string[];
  volume: number | null;
  difficulty: number | null;
  cpc: number | null;
  gscImpressions: number | null;
  gscClicks: number | null;
  gscPosition: number | null;
  coverage: 'new_opportunity' | 'in_backlog' | 'covered_article' | 'covered_tool';
  inBacklog: boolean;
  backlogId: number | null;
  backlogStatus: SeoStatus | null;
  matchedArticle: { id: number; slug: string; title: string; status: string } | null;
  matchedToolPath: string | null;
  suggestedSlug: string;
}

export interface KeywordResearchResult {
  seed: string;
  researchedAt: string;
  sourcesUsed: string[];
  reviewWebConnected: boolean;
  reviewWebNote: string | null;
  googleSuggestCount: number;
  items: ResearchedKeywordItem[];
}

function stripDiacriticsLower(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function paddedAscii(text: string): string {
  return ` ${stripDiacriticsLower(text)} `;
}

function containsAnyPhrase(padded: string, phrases: string[]): boolean {
  return phrases.some((p) => padded.includes(` ${p} `));
}

/** Classifies search intent for Vietnamese & bilingual tech queries without relying on ASCII \b boundaries. */
export function classifyVietnameseIntent(keyword: string): SeoIntent {
  const padded = paddedAscii(keyword);
  if (
    containsAnyPhrase(padded, [
      'tqd',
      'dungtq',
      'trinh quang dung',
      'goclaw',
      'tqd me',
    ])
  ) {
    return 'navigational';
  }
  if (
    containsAnyPhrase(padded, [
      'mua',
      'bang gia',
      'gia bao nhieu',
      'thue',
      'dang ky',
      'tai',
      'download',
      'shop',
      'nang cap',
      'tai khoan',
      'goi',
      'dat lich',
      'lien he',
    ])
  ) {
    return 'transactional';
  }
  if (
    containsAnyPhrase(padded, [
      'tot nhat',
      'so sanh',
      'khac gi',
      'review',
      'danh gia',
      'top',
      'nen dung',
      'hay',
      'thay the',
      'nen mua',
      'chon',
      'uu nhuoc diem',
    ])
  ) {
    return 'commercial';
  }
  return 'informational';
}

export function suggestPriorityFromIntent(intent: SeoIntent, isSeedMatch: boolean): SeoPriority {
  if (isSeedMatch || intent === 'transactional' || intent === 'commercial') return 'high';
  return 'medium';
}

const OFF_BRAND_SUGGEST_TOKENS = ['voz', 'viblo', 'crypto', 'coin', 'crack', 'mod apk', 'tai game'];

export function isOffBrandSuggestNoise(suggestion: string, seedAscii: string): boolean {
  const padded = paddedAscii(suggestion);
  return OFF_BRAND_SUGGEST_TOKENS.some(
    (tok) => padded.includes(` ${tok} `) && !` ${seedAscii} `.includes(` ${tok} `),
  );
}

/** Fetches Vietnamese autocomplete suggestions from Google Suggest across intent modifiers. */
export async function fetchGoogleSuggestVi(
  seed: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ suggestions: string[]; ok: boolean }> {
  const cleanSeed = seed.normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, 120);
  if (!cleanSeed) return { suggestions: [], ok: false };

  const asciiSeed = stripDiacriticsLower(cleanSeed);
  const queries = new Set<string>([cleanSeed]);
  if (!asciiSeed.includes('la gi')) queries.add(`${cleanSeed} là gì`);
  if (!asciiSeed.startsWith('cach ')) queries.add(`cách ${cleanSeed}`);
  if (!asciiSeed.includes('doanh nghiep')) queries.add(`${cleanSeed} cho doanh nghiệp`);
  if (!asciiSeed.includes('mien phi')) queries.add(`${cleanSeed} miễn phí`);
  if (!asciiSeed.includes('so sanh') && !asciiSeed.includes('khac gi')) queries.add(`so sánh ${cleanSeed}`);

  const seen = new Map<string, string>();
  let anySuccess = false;

  const responses = await Promise.allSettled(
    [...queries].map(async (q) => {
      const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=vi&gl=vn&q=${encodeURIComponent(q)}`;
      const res = await fetchImpl(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; TQD-SEO-Bot/1.0; +https://tqd.me)',
        },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = (await res.json()) as unknown;
      if (!Array.isArray(payload) || !Array.isArray(payload[1])) return [];
      return payload[1].filter((item): item is string => typeof item === 'string');
    }),
  );

  for (const r of responses) {
    if (r.status === 'fulfilled') {
      anySuccess = true;
      for (const s of r.value) {
        const cleaned = s.normalize('NFKC').trim().replace(/\s+/g, ' ');
        if (!cleaned || isOffBrandSuggestNoise(cleaned, asciiSeed)) continue;
        const norm = normalizeKeywordKey(cleaned);
        if (!seen.has(norm)) {
          seen.set(norm, cleaned.slice(0, 160));
        }
        if (seen.size >= 40) break;
      }
    }
    if (seen.size >= 40) break;
  }

  return { suggestions: [...seen.values()], ok: anySuccess };
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Optional enrichment via ReviewWeb.site SEO Insights API when REVIEWWEB_API_KEY is configured. */
export async function fetchReviewWebMetrics(
  seed: string,
  apiKey: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<{
  connected: boolean;
  ideas: ReviewWebIdea[];
  note: string | null;
}> {
  const key = (apiKey ?? '').trim();
  if (!key) {
    return {
      connected: false,
      ideas: [],
      note: 'Chưa gắn REVIEWWEB_API_KEY nên cột Lượt tìm và Độ khó được để trống (không tự bịa số liệu).',
    };
  }

  try {
    const res = await fetchImpl('https://reviewweb.site/api/v1/seo-insights/keyword-ideas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': key,
      },
      body: JSON.stringify({ keyword: seed, country: 'vn' }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      return {
        connected: true,
        ideas: [],
        note: `ReviewWeb API trả mã HTTP ${res.status}; tạm hiển thị dữ liệu từ Google Gợi ý.`,
      };
    }
    const json = (await res.json()) as {
      success?: boolean;
      data?: unknown;
      keywords?: unknown;
      message?: string;
    };
    const rawList = Array.isArray(json.data)
      ? json.data
      : Array.isArray((json.data as { keywords?: unknown } | undefined)?.keywords)
        ? ((json.data as { keywords: unknown[] }).keywords)
        : Array.isArray(json.keywords)
          ? json.keywords
          : [];

    const ideas: ReviewWebIdea[] = [];
    for (const entry of rawList) {
      if (!entry || typeof entry !== 'object') continue;
      const obj = entry as Record<string, unknown>;
      const kw = String(obj.keyword ?? obj.term ?? obj.query ?? '').trim();
      if (!kw) continue;
      const vol = numOrNull(obj.volume ?? obj.searchVolume ?? obj.search_volume);
      const diff = numOrNull(obj.difficulty ?? obj.keywordDifficulty ?? obj.kd);
      const cpc = numOrNull(obj.cpc);
      ideas.push({
        keyword: kw.slice(0, 160),
        volume: vol !== null ? Math.round(vol) : null,
        difficulty: diff !== null ? Math.min(100, Math.max(0, Math.round(diff))) : null,
        cpc: cpc !== null ? Math.round(cpc * 100) / 100 : null,
      });
    }
    return {
      connected: true,
      ideas,
      note: ideas.length > 0 ? null : 'ReviewWeb API đã kết nối nhưng không có thêm gợi ý cho cụm từ này.',
    };
  } catch (err) {
    return {
      connected: true,
      ideas: [],
      note: `Không thể gọi ReviewWeb API lúc này (${err instanceof Error ? err.message : 'timeout'}).`,
    };
  }
}

function detectToolPath(keyword: string): string | null {
  const padded = paddedAscii(keyword);
  if (
    containsAnyPhrase(padded, ['tai video', 'tai nhac', 'download video', 'yt dlp', 'tiktok khong logo', 'tai shorts', 'tai reels', 'mp3 320'])
  ) {
    return '/tai-video';
  }
  if (
    containsAnyPhrase(padded, ['veo 3', 'veo ultra', 'tai khoan claude', 'tai khoan veo', 'google ai ultra', 'shop', 'cua hang ai'])
  ) {
    return '/shop';
  }
  if (containsAnyPhrase(padded, ['video ai', 'phim ai'])) {
    return '/video-ai';
  }
  if (containsAnyPhrase(padded, ['san pham ai', 'goclaw', 'chup x quang bai viet', 'viral transcript'])) {
    return '/san-pham';
  }
  return null;
}

function tokenSet(asciiStr: string): string[] {
  return asciiStr
    .split(' ')
    .filter((t) => t.length >= 2 && !['la', 'gi', 'cho', 'va', 'cua', 'cach', 'voi', 'trong', 'hay'].includes(t));
}

function matchArticleCoverage(
  kw: string,
  articles: Array<{ id: number; slug: string; title: string; status: string; tags: string }>,
): { id: number; slug: string; title: string; status: string } | null {
  const kwAscii = stripDiacriticsLower(kw);
  const kwTokens = tokenSet(kwAscii);
  if (kwTokens.length === 0) return null;

  let best: { article: { id: number; slug: string; title: string; status: string }; score: number } | null = null;
  for (const a of articles) {
    const titleAscii = stripDiacriticsLower(`${a.title} ${a.slug.replace(/-/g, ' ')} ${a.tags}`);
    if (titleAscii.includes(kwAscii) && kwAscii.length >= 6) {
      return { id: a.id, slug: a.slug, title: a.title, status: a.status };
    }
    const hits = kwTokens.filter((t) => titleAscii.includes(t)).length;
    const ratio = hits / kwTokens.length;
    if (ratio >= 0.75 && hits >= 2 && (!best || ratio > best.score)) {
      best = { article: { id: a.id, slug: a.slug, title: a.title, status: a.status }, score: ratio };
    }
  }
  return best?.article ?? null;
}

/** Runs end-to-end Vietnamese keyword research and cross-checks tqd.me articles, tools, backlog, and GSC data. */
export async function researchKeywords(
  db: D1Database,
  seed: string,
  opts: {
    reviewWebApiKey?: string;
    siteUrl?: string;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<KeywordResearchResult> {
  const cleanSeed = seed.normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, 120);
  const fetchImpl = opts.fetchImpl ?? fetch;
  const siteUrl = (opts.siteUrl || 'sc-domain:tqd.me').trim();

  const [suggestRes, rwRes, articlesRes, backlogRes, gscRes] = await Promise.all([
    fetchGoogleSuggestVi(cleanSeed, fetchImpl),
    fetchReviewWebMetrics(cleanSeed, opts.reviewWebApiKey, fetchImpl),
    db
      .prepare('SELECT id, slug, title, status, tags FROM articles ORDER BY updated_at DESC LIMIT 200')
      .all<{ id: number; slug: string; title: string; status: string; tags: string }>()
      .catch(() => ({ results: [] as Array<{ id: number; slug: string; title: string; status: string; tags: string }> })),
    db
      .prepare('SELECT id, keyword_norm, status, target_slug FROM seo_keywords')
      .all<{ id: number; keyword_norm: string; status: string; target_slug: string | null }>()
      .catch(() => ({ results: [] as Array<{ id: number; keyword_norm: string; status: string; target_slug: string | null }> })),
    db
      .prepare(
        `SELECT query, SUM(clicks) AS clicks, SUM(impressions) AS impressions,
                CASE WHEN SUM(impressions) > 0 THEN SUM(position * impressions) * 1.0 / SUM(impressions) ELSE AVG(position) END AS position
         FROM seo_gsc_daily WHERE site = ?1 GROUP BY query`,
      )
      .bind(siteUrl)
      .all<{ query: string; clicks: number; impressions: number; position: number }>()
      .catch(() => ({ results: [] as Array<{ query: string; clicks: number; impressions: number; position: number }> })),
  ]);

  const backlogMap = new Map<string, { id: number; status: SeoStatus; targetSlug: string | null }>();
  for (const row of backlogRes.results ?? []) {
    backlogMap.set(row.keyword_norm, {
      id: row.id,
      status: row.status as SeoStatus,
      targetSlug: row.target_slug,
    });
  }

  const gscMap = new Map<string, { clicks: number; impressions: number; position: number }>();
  for (const row of gscRes.results ?? []) {
    gscMap.set(normalizeKeywordKey(row.query), {
      clicks: Number(row.clicks ?? 0),
      impressions: Number(row.impressions ?? 0),
      position: Math.round(Number(row.position ?? 0) * 10) / 10,
    });
  }

  const merged = new Map<
    string,
    {
      keyword: string;
      sources: Set<string>;
      volume: number | null;
      difficulty: number | null;
      cpc: number | null;
    }
  >();

  const ensureEntry = (kw: string, source: string) => {
    const norm = normalizeKeywordKey(kw);
    if (!norm) return null;
    let entry = merged.get(norm);
    if (!entry) {
      entry = { keyword: kw, sources: new Set([source]), volume: null, difficulty: null, cpc: null };
      merged.set(norm, entry);
    } else {
      entry.sources.add(source);
    }
    return entry;
  };

  if (cleanSeed) {
    ensureEntry(cleanSeed, 'Gốc tìm kiếm');
  }
  for (const s of suggestRes.suggestions) {
    ensureEntry(s, 'Google Gợi ý VN');
  }
  for (const rw of rwRes.ideas) {
    const entry = ensureEntry(rw.keyword, 'ReviewWeb');
    if (entry) {
      if (rw.volume !== null) entry.volume = rw.volume;
      if (rw.difficulty !== null) entry.difficulty = rw.difficulty;
      if (rw.cpc !== null) entry.cpc = rw.cpc;
    }
  }

  const articles = articlesRes.results ?? [];
  const seedNorm = normalizeKeywordKey(cleanSeed);
  const items: ResearchedKeywordItem[] = [];

  for (const [norm, entry] of merged.entries()) {
    const intent = classifyVietnameseIntent(entry.keyword);
    const priority = suggestPriorityFromIntent(intent, norm === seedNorm);
    const backlog = backlogMap.get(norm) ?? null;
    const matchedArticle = matchArticleCoverage(entry.keyword, articles);
    const matchedToolPath = detectToolPath(entry.keyword);
    const gsc = gscMap.get(norm) ?? null;

    let coverage: ResearchedKeywordItem['coverage'] = 'new_opportunity';
    if (matchedArticle && matchedArticle.status === 'published') coverage = 'covered_article';
    else if (matchedToolPath) coverage = 'covered_tool';
    else if (backlog) coverage = 'in_backlog';

    items.push({
      keyword: entry.keyword,
      keywordNorm: norm,
      intent,
      priority,
      sources: [...entry.sources],
      volume: entry.volume,
      difficulty: entry.difficulty,
      cpc: entry.cpc,
      gscImpressions: gsc?.impressions ?? null,
      gscClicks: gsc?.clicks ?? null,
      gscPosition: gsc?.position ?? null,
      coverage,
      inBacklog: Boolean(backlog),
      backlogId: backlog?.id ?? null,
      backlogStatus: backlog?.status ?? null,
      matchedArticle,
      matchedToolPath,
      suggestedSlug: slugify(entry.keyword) || 'bai-viet-moi',
    });
  }

  const sourcesUsed: string[] = [];
  if (suggestRes.ok) sourcesUsed.push('Google Suggest VN (hl=vi, gl=vn)');
  if (rwRes.connected && rwRes.ideas.length > 0) sourcesUsed.push('ReviewWeb.site API');
  if (articles.length > 0) sourcesUsed.push('Kho bài viết tqd.me');

  return {
    seed: cleanSeed,
    researchedAt: new Date().toISOString(),
    sourcesUsed,
    reviewWebConnected: rwRes.connected,
    reviewWebNote: rwRes.note,
    googleSuggestCount: suggestRes.suggestions.length,
    items,
  };
}
