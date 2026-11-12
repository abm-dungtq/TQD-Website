-- Viral Video Lab: 30-day cached transcripts and shareable X-Ray / Script reports (/xray/[id]).
CREATE TABLE IF NOT EXISTS viral_transcripts (
  video_hash TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  platform_label TEXT NOT NULL DEFAULT '',
  canonical_url TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  uploader TEXT NOT NULL DEFAULT '',
  duration INTEGER NOT NULL DEFAULT 0,
  thumbnail TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT 'vi',
  source_kind TEXT NOT NULL DEFAULT 'whisper',
  transcript_text TEXT NOT NULL,
  segments_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_viral_transcripts_created ON viral_transcripts(created_at);

CREATE TABLE IF NOT EXISTS viral_shares (
  share_id TEXT PRIMARY KEY,
  video_hash TEXT NOT NULL,
  platform_label TEXT NOT NULL DEFAULT '',
  canonical_url TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  uploader TEXT NOT NULL DEFAULT '',
  duration INTEGER NOT NULL DEFAULT 0,
  format_key TEXT NOT NULL,
  industry TEXT NOT NULL DEFAULT '',
  xray_markdown TEXT NOT NULL DEFAULT '',
  script_markdown TEXT NOT NULL DEFAULT '',
  viet_pro_score INTEGER NOT NULL DEFAULT 100,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_viral_shares_created ON viral_shares(created_at);
