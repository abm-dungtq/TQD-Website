-- Daily aggregated analytics for tuvi.tqd.me and tqd.me (UTC+7 Vietnam days).
CREATE TABLE IF NOT EXISTS analytics_daily (
  site TEXT NOT NULL,
  day TEXT NOT NULL,
  metric TEXT NOT NULL,
  dim TEXT NOT NULL DEFAULT '',
  value REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (site, day, metric, dim)
);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_site_metric_day
  ON analytics_daily (site, metric, day);
