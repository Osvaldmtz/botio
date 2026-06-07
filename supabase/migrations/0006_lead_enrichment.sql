-- Lead enrichment fields persisted when notify_sales_team fires.

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS lead_score integer,
  ADD COLUMN IF NOT EXISTS lead_temperature text,
  ADD COLUMN IF NOT EXISTS lead_country text,
  ADD COLUMN IF NOT EXISTS lead_city text,
  ADD COLUMN IF NOT EXISTS lead_intent text,
  ADD COLUMN IF NOT EXISTS lead_signals jsonb,
  ADD COLUMN IF NOT EXISTS enriched_at timestamptz;
