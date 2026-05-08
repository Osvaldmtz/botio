-- Conversation guard columns for automatic cutoff logic.
--
-- is_closed:     when true, incoming messages are silently ignored by the webhook.
-- close_reason:  why the conversation was closed ('no_lead_limit' | 'suspected_bot').
-- closed_at:     timestamp when the guard fired.
-- lead_captured: set to true when notify_sales_team fires with reason
--                'new_lead' or 'purchase_intent'.

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS is_closed     boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS close_reason  text,
  ADD COLUMN IF NOT EXISTS closed_at     timestamptz,
  ADD COLUMN IF NOT EXISTS lead_captured boolean     NOT NULL DEFAULT false;
