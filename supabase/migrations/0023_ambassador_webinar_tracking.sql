-- Ambassador program webinar tracking on conversations.

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS webinar_link_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS webinar_registered boolean DEFAULT false;
