-- Message source tracking for text vs audio (and future channels).

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'text';

CREATE INDEX IF NOT EXISTS messages_source_idx ON public.messages (source);
