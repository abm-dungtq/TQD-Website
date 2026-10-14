-- Daily chat counters for /admin/chat. Days are Vietnam dates (UTC+7). No message text is stored.
CREATE TABLE chat_daily (
  day TEXT PRIMARY KEY,
  answered INTEGER NOT NULL DEFAULT 0,
  limited INTEGER NOT NULL DEFAULT 0,
  offline INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0
);
-- One row per visitor per day, to count distinct visitors; the visitor id is hashed and kept 90 days.
CREATE TABLE chat_visitors (
  day TEXT NOT NULL,
  visitor TEXT NOT NULL,
  PRIMARY KEY (day, visitor)
);
