-- SEO & Keyword Research Hub (/admin/seo + /ak-seo integration)
CREATE TABLE IF NOT EXISTS seo_gsc_daily (
  site TEXT NOT NULL DEFAULT 'sc-domain:tqd.me',
  day TEXT NOT NULL,
  query TEXT NOT NULL,
  page TEXT NOT NULL DEFAULT '',
  clicks REAL NOT NULL DEFAULT 0,
  impressions REAL NOT NULL DEFAULT 0,
  ctr REAL NOT NULL DEFAULT 0,
  position REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (site, day, query, page)
);
CREATE INDEX IF NOT EXISTS idx_seo_gsc_site_day ON seo_gsc_daily (site, day DESC);
CREATE INDEX IF NOT EXISTS idx_seo_gsc_site_query ON seo_gsc_daily (site, query);

CREATE TABLE IF NOT EXISTS seo_keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword_norm TEXT NOT NULL UNIQUE,
  keyword TEXT NOT NULL,
  cluster TEXT NOT NULL DEFAULT '',
  intent TEXT NOT NULL DEFAULT 'informational' CHECK (intent IN ('informational','commercial','transactional','navigational')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
  status TEXT NOT NULL DEFAULT 'idea' CHECK (status IN ('idea','planned','drafting','published','archived')),
  volume INTEGER,
  difficulty INTEGER,
  cpc REAL,
  source TEXT NOT NULL DEFAULT 'admin',
  target_slug TEXT,
  suggested_title TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_seo_keywords_status_priority ON seo_keywords (status, priority, updated_at DESC);

CREATE TABLE IF NOT EXISTS seo_snapshots (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
