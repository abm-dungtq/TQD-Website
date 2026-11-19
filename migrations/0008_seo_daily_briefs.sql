-- Daily SEO + GEO Editorial Brief Queue for autonomous publishing agents (/api/v1/seo/next-brief & /admin/seo)
CREATE TABLE IF NOT EXISTS seo_daily_briefs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day_order INTEGER NOT NULL DEFAULT 100,
  pillar TEXT NOT NULL CHECK (pillar IN ('ai-agent-sme','cua-hang-ai-roi','xuong-video-viral','vibe-code-cloudflare','viet-pro-geo-ax')),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  primary_keyword TEXT NOT NULL,
  secondary_keywords_json TEXT NOT NULL DEFAULT '[]',
  geo_questions_json TEXT NOT NULL DEFAULT '[]',
  answer_capsule_hint TEXT NOT NULL DEFAULT '',
  sections_json TEXT NOT NULL DEFAULT '[]',
  table_spec TEXT NOT NULL DEFAULT '',
  eeat_anchor TEXT NOT NULL DEFAULT '',
  internal_links_json TEXT NOT NULL DEFAULT '[]',
  cta_path TEXT NOT NULL DEFAULT '/ho-so',
  analogy TEXT NOT NULL DEFAULT '',
  fb_angle TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','writing','published','skipped')),
  claimed_by TEXT,
  claimed_at TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_seo_daily_briefs_queue ON seo_daily_briefs (status, day_order ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_seo_daily_briefs_pillar ON seo_daily_briefs (pillar, status, day_order ASC);

-- Clean off-brand forum/crypto suggest noise from previous keyword tests
DELETE FROM seo_keywords
WHERE status = 'planned'
  AND source IN ('google-suggest-vn', 'keyword-lab')
  AND (
    keyword_norm LIKE '% voz%'
    OR keyword_norm LIKE '% viblo%'
    OR keyword_norm LIKE '%crypto%'
    OR keyword_norm LIKE '%github%'
  );
