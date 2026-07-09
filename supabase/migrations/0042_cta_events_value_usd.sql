-- Monetary value per CTA event for revenue attribution

ALTER TABLE public.cta_events
  ADD COLUMN IF NOT EXISTS value_usd numeric(10, 2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_cta_events_source_timestamp
  ON public.cta_events (source, event_timestamp DESC);
