-- Ambassador program tracking on conversations.

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS is_ambassador boolean DEFAULT false;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS webinar_link_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS webinar_registered boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS conversations_is_ambassador_idx
  ON public.conversations(is_ambassador)
  WHERE is_ambassador = true;

NOTIFY pgrst, 'reload schema';
