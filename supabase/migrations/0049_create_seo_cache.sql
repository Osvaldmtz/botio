CREATE TABLE IF NOT EXISTS seo_cache (
  key TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seo_cache_fetched_at ON seo_cache (fetched_at DESC);
