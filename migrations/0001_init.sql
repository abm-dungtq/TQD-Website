CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('product','training','video')),
  title TEXT NOT NULL,
  date TEXT,
  summary TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  links TEXT NOT NULL DEFAULT '[]',
  tiktok_id TEXT,
  cover_key TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX items_kind_sort ON items(kind, sort);
CREATE TABLE articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  body_md TEXT NOT NULL,
  body_html TEXT NOT NULL,
  cover_key TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  source TEXT NOT NULL DEFAULT 'admin',
  fb_overlap INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX articles_status_published ON articles(status, published_at DESC);
CREATE TABLE media (
  key TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  alt TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  hash TEXT NOT NULL UNIQUE,
  scopes TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT,
  revoked_at TEXT
);
CREATE TABLE sessions (id_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
CREATE TABLE rate_limits (bucket TEXT PRIMARY KEY, window_start INTEGER NOT NULL, count INTEGER NOT NULL);
