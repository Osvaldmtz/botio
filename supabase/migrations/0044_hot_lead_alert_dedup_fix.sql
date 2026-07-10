-- Stop duplicate HOT lead Telegram alerts:
-- 1) dedicated dedup column (survives lead_signals overwrites)
-- 2) trigger never reopens processed queue rows

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS hot_alert_sent_at timestamptz;

-- Backfill from existing hot_alert:* signals
UPDATE public.conversations c
SET hot_alert_sent_at = sub.sent_at
FROM (
  SELECT
    c2.id,
    MAX((REPLACE(signal, 'hot_alert:', ''))::timestamptz) AS sent_at
  FROM public.conversations c2
  CROSS JOIN LATERAL jsonb_array_elements_text(c2.lead_signals) AS signal
  WHERE signal LIKE 'hot_alert:%'
  GROUP BY c2.id
) sub
WHERE c.id = sub.id
  AND c.hot_alert_sent_at IS NULL;

CREATE OR REPLACE FUNCTION public.enqueue_hot_lead_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.lead_score IS NOT NULL
     AND NEW.lead_score >= 70
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.lead_score, 0) < 70)
  THEN
    INSERT INTO public.hot_lead_alert_queue (conversation_id, lead_score)
    VALUES (NEW.id, NEW.lead_score)
    ON CONFLICT (conversation_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Close all stale pending rows and any row already alerted.
UPDATE public.hot_lead_alert_queue q
SET processed_at = now()
WHERE q.processed_at IS NULL
  AND (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = q.conversation_id
        AND (
          c.hot_alert_sent_at IS NOT NULL
          OR COALESCE(c.last_message_at, c.enriched_at, c.created_at) < now() - interval '2 hours'
        )
    )
  );
