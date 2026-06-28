-- ML del Pobre Fase 1: conversation outcome tracking

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS outcome TEXT,
  ADD COLUMN IF NOT EXISTS outcome_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outcome_source TEXT;

CREATE INDEX IF NOT EXISTS idx_conversations_outcome
  ON public.conversations (outcome)
  WHERE outcome IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_outcome_null_last_msg
  ON public.conversations (last_message_at)
  WHERE outcome IS NULL;

COMMENT ON COLUMN public.conversations.outcome IS
  'paid | trial_activated | lost_no_response | lost_objection | lost_competitor | lost_price | unsubscribed';
