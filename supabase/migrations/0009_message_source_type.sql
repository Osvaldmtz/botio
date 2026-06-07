-- Track whether assistant replies came from Claude or the response cache.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'claude';

CREATE INDEX IF NOT EXISTS messages_source_type_idx
  ON public.messages (source_type);
