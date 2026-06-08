ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closure_reason text CHECK (
    closure_reason IN (
      'price',
      'thinking',
      'competition',
      'no_time',
      'not_useful',
      'no_response',
      'converted',
      'other'
    )
    OR closure_reason IS NULL
  ),
  ADD COLUMN IF NOT EXISTS closure_note text,
  ADD COLUMN IF NOT EXISTS closed_by text;

CREATE INDEX IF NOT EXISTS conversations_closure_reason_idx
  ON public.conversations(closure_reason)
  WHERE closure_reason IS NOT NULL;

CREATE INDEX IF NOT EXISTS conversations_closed_at_idx
  ON public.conversations(closed_at)
  WHERE closed_at IS NOT NULL;

DROP VIEW IF EXISTS public.conversation_summary;

CREATE VIEW public.conversation_summary AS
SELECT
  c.id,
  c.customer_phone,
  c.bot_id,
  c.channel,
  c.session_id,
  c.created_at,
  c.lead_captured,
  c.is_closed,
  c.close_reason,
  c.closed_at,
  c.closure_reason,
  c.closure_note,
  c.closed_by,
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
  c.pipeline_stage,
  c.pipeline_stage_updated_at,
  c.pipeline_stage_updated_by,
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
  c.channel,
  c.session_id,
  c.created_at,
  c.lead_captured,
  c.is_closed,
  c.close_reason,
  c.closed_at,
  c.closure_reason,
  c.closure_note,
  c.closed_by,
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
  c.pipeline_stage,
  c.pipeline_stage_updated_at,
  c.pipeline_stage_updated_by,
  b.name;
