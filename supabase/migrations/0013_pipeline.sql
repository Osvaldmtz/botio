-- Sales pipeline stages for Kanban dashboard.

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS pipeline_stage text DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS pipeline_stage_updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS pipeline_stage_updated_by text;

CREATE INDEX IF NOT EXISTS conversations_pipeline_idx
  ON public.conversations (bot_id, pipeline_stage);

CREATE TABLE IF NOT EXISTS public.pipeline_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  from_stage text,
  to_stage text NOT NULL,
  moved_by text,
  moved_at timestamptz DEFAULT now(),
  reason text DEFAULT 'manual'
);

CREATE INDEX IF NOT EXISTS pipeline_history_conv_idx
  ON public.pipeline_stage_history (conversation_id, moved_at DESC);

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
  c.pipeline_stage,
  c.pipeline_stage_updated_at,
  c.pipeline_stage_updated_by,
  b.name;
