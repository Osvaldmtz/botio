-- Human handoff: admin takes control and bot stops auto-replying.

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS handoff_active boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS handoff_taken_by text,
  ADD COLUMN IF NOT EXISTS handoff_started_at timestamptz;

CREATE INDEX IF NOT EXISTS conversations_handoff_idx
  ON public.conversations (handoff_active)
  WHERE handoff_active = true;

COMMENT ON COLUMN public.messages.source_type IS
  'Origin: claude, cache, human, user, fallback';

DROP VIEW IF EXISTS public.conversation_summary;

CREATE VIEW public.conversation_summary AS
SELECT
  c.id,
  c.customer_phone,
  c.bot_id,
  c.created_at,
  c.lead_captured,
  c.is_closed,
  c.close_reason,
  c.followup_sent,
  c.last_message_at,
  c.lead_score,
  c.lead_temperature,
  c.lead_country,
  c.lead_city,
  c.lead_intent,
  c.lead_signals,
  c.enriched_at,
  c.handoff_active,
  c.handoff_taken_by,
  c.handoff_started_at,
  b.name AS bot_name,
  count(m.id)::int AS message_count,
  (
    SELECT m2.content
    FROM public.messages m2
    WHERE m2.conversation_id = c.id
    ORDER BY m2.created_at DESC
    LIMIT 1
  ) AS last_message_content,
  (
    SELECT m2.role
    FROM public.messages m2
    WHERE m2.conversation_id = c.id
    ORDER BY m2.created_at DESC
    LIMIT 1
  ) AS last_message_role,
  (
    SELECT m2.role = 'user' AND NOT c.is_closed AND NOT c.handoff_active
    FROM public.messages m2
    WHERE m2.conversation_id = c.id
    ORDER BY m2.created_at DESC
    LIMIT 1
  ) AS needs_reply
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
  c.close_reason,
  c.followup_sent,
  c.last_message_at,
  c.lead_score,
  c.lead_temperature,
  c.lead_country,
  c.lead_city,
  c.lead_intent,
  c.lead_signals,
  c.enriched_at,
  c.handoff_active,
  c.handoff_taken_by,
  c.handoff_started_at,
  b.name;
