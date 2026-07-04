-- Move former ambassador leads into the main client conversations module.
-- Preserves created_at / message history; clears ambassador-only routing flags.

UPDATE public.conversations
SET
  is_ambassador = false,
  lead_intent = CASE
    WHEN lead_intent = 'Embajadores' THEN NULL
    ELSE lead_intent
  END,
  metadata = (
    COALESCE(metadata, '{}'::jsonb)
    - 'is_ambassador_lead'
    - 'ambassador_detected_at'
  )
WHERE is_ambassador = true
   OR COALESCE(metadata->>'is_ambassador_lead', 'false') = 'true';

-- Tag legacy automated follow-ups missing source (pre-metadata lead-followup cron).
UPDATE public.messages m
SET metadata = COALESCE(m.metadata, '{}'::jsonb) || '{"source":"lead_followup"}'::jsonb
FROM public.conversations c
WHERE m.conversation_id = c.id
  AND c.followup_sent = true
  AND m.role = 'assistant'
  AND COALESCE(m.metadata->>'source', '') = ''
  AND COALESCE(m.source, 'text') = 'text';
