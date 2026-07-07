-- Only reopen the hot lead queue when score strictly increases after crossing threshold.
-- Do not reset processed_at merely because the row was already processed.

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
    ON CONFLICT (conversation_id) DO UPDATE
      SET lead_score = EXCLUDED.lead_score,
          created_at = now(),
          processed_at = NULL
      WHERE EXCLUDED.lead_score > COALESCE(hot_lead_alert_queue.lead_score, 0);
  END IF;
  RETURN NEW;
END;
$$;

-- Close stale pending queue rows for conversations already alerted.
UPDATE public.hot_lead_alert_queue q
SET processed_at = now()
WHERE q.processed_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = q.conversation_id
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(c.lead_signals) AS signal
        WHERE signal LIKE 'hot_alert:%'
      )
  );
