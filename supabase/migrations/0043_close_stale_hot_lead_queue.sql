-- Close backlog queue rows for conversations inactive >2 hours.
-- Prevents delayed cron alerts for leads that are no longer actionable.

UPDATE public.hot_lead_alert_queue q
SET processed_at = now()
WHERE q.processed_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = q.conversation_id
      AND COALESCE(c.last_message_at, c.enriched_at, c.created_at) < now() - interval '2 hours'
  );
