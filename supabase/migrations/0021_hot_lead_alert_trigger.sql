-- Queue HOT lead alerts when score crosses threshold via direct DB writes.
-- Processed by /api/cron/hot-lead-alerts (or internal notify endpoint).

CREATE TABLE IF NOT EXISTS public.hot_lead_alert_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  lead_score integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (conversation_id)
);

CREATE INDEX IF NOT EXISTS hot_lead_alert_queue_pending_idx
  ON public.hot_lead_alert_queue (created_at)
  WHERE processed_at IS NULL;

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
      WHERE hot_lead_alert_queue.processed_at IS NOT NULL
         OR COALESCE(hot_lead_alert_queue.lead_score, 0) < 70;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS conversations_hot_lead_alert_enqueue ON public.conversations;

CREATE TRIGGER conversations_hot_lead_alert_enqueue
  AFTER INSERT OR UPDATE OF lead_score ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_hot_lead_alert();
