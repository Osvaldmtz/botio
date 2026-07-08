-- Landing CTA events ingested from kalyo.io via /api/cta-track

CREATE TABLE IF NOT EXISTS public.cta_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  source text,
  event_timestamp timestamptz NOT NULL DEFAULT now(),
  session_id text,
  country text,
  city text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cta_events_event_timestamp
  ON public.cta_events (event_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_cta_events_event_name
  ON public.cta_events (event_name, event_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_cta_events_session_id
  ON public.cta_events (session_id)
  WHERE session_id IS NOT NULL;
