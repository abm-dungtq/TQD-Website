import queueData from '../../../plans/seo-aeo-queue.json';
import { classifyVietnameseIntent } from './keyword-research';
import { type SeoKeywordInput, upsertSeoKeywords } from './store';

interface QueueArticle {
  order?: number;
  code?: string;
  stage?: string;
  slug: string;
  title: string;
  analogy?: string;
  targetKeywords?: string[];
}

interface QueuePayload {
  hubSlug?: string;
  hubTitle?: string;
  articles?: QueueArticle[];
}

export function buildQueueKeywordInputs(
  existingArticlesBySlug: Map<string, string> = new Map(),
): SeoKeywordInput[] {
  const payload = queueData as QueuePayload;
  const inputs: SeoKeywordInput[] = [];

  if (payload.hubSlug && payload.hubTitle) {
    const hubArticleStatus = existingArticlesBySlug.get(payload.hubSlug);
    inputs.push({
      keyword: 'từ điển AI và AI Agent cho người không biết lập trình',
      cluster: 'Trụ cột (Hub)',
      intent: 'informational',
      priority: 'high',
      status:
        hubArticleStatus === 'published'
          ? 'published'
          : hubArticleStatus === 'draft'
            ? 'drafting'
            : 'planned',
      source: 'seo-aeo-queue',
      targetSlug: payload.hubSlug,
      suggestedTitle: payload.hubTitle,
      notes: 'Bài tổng hợp trụ cột nối toàn bộ 12 chủ đề trong lộ trình AI Agent.',
    });
  }

  for (const article of payload.articles ?? []) {
    const articleStatus = existingArticlesBySlug.get(article.slug);
    const derivedStatus =
      articleStatus === 'published'
        ? 'published'
        : articleStatus === 'draft'
          ? 'drafting'
          : 'planned';

    const kws = article.targetKeywords ?? [];
    kws.forEach((kw, idx) => {
      inputs.push({
        keyword: kw,
        cluster: article.stage || 'Lộ trình AI Agent',
        intent: classifyVietnameseIntent(kw),
        priority: idx === 0 ? 'high' : 'medium',
        status: derivedStatus,
        source: 'seo-aeo-queue',
        targetSlug: article.slug,
        suggestedTitle: article.title,
        notes: article.analogy || '',
      });
    });
  }

  return inputs;
}

/** Seeds seo_keywords idempotently from plans/seo-aeo-queue.json and syncs status with existing D1 articles. */
export async function seedKeywordsFromQueue(db: D1Database): Promise<number> {
  const articlesRes = await db
    .prepare('SELECT slug, status FROM articles')
    .all<{ slug: string; status: string }>()
    .catch(() => ({ results: [] as Array<{ slug: string; status: string }> }));

  const bySlug = new Map<string, string>();
  for (const row of articlesRes.results ?? []) {
    bySlug.set(row.slug, row.status);
  }

  const inputs = buildQueueKeywordInputs(bySlug);
  return upsertSeoKeywords(db, inputs);
}
