-- Conversation follow-up support: denormalized last_message_at for cron queries,
-- followup_sent flag (may already exist in some environments), and enriched summary view.

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS followup_sent boolean NOT NULL DEFAULT false;

-- Backfill last_message_at from existing messages.
UPDATE public.conversations c
SET last_message_at = sub.max_at
FROM (
  SELECT conversation_id, max(created_at) AS max_at
  FROM public.messages
  GROUP BY conversation_id
) sub
WHERE c.id = sub.conversation_id
  AND c.last_message_at IS NULL;

-- Conversations with no messages yet fall back to created_at.
UPDATE public.conversations
SET last_message_at = created_at
WHERE last_message_at IS NULL;

CREATE INDEX IF NOT EXISTS conversations_followup_idx
  ON public.conversations (bot_id, followup_sent, last_message_at)
  WHERE followup_sent = false;

-- Recreate the summary view with funnel fields used by admin metrics and follow-up cron.
DROP VIEW IF EXISTS public.conversation_summary;

CREATE VIEW public.conversation_summary AS
SELECT
  c.id,
  c.customer_phone,
  c.bot_id,
  c.created_at,
  c.lead_captured,
  c.is_closed,
  c.followup_sent,
  c.last_message_at,
  b.name                                                AS bot_name,
  count(m.id)::int                                      AS message_count,
  (
    SELECT m2.content
    FROM public.messages m2
    WHERE m2.conversation_id = c.id
    ORDER BY m2.created_at DESC
    LIMIT 1
  )                                                     AS last_message_content
FROM public.conversations c
JOIN public.bots b ON b.id = c.bot_id
LEFT JOIN public.messages m ON m.conversation_id = c.id
GROUP BY
  c.id,
  c.customer_phone,
  c.bot_id,
  c.created_at,
  c.lead_captured,
  c.is_closed,
  c.followup_sent,
  c.last_message_at,
  b.name;
