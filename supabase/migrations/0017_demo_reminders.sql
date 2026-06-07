-- WhatsApp demo reminders + customer response tracking.

ALTER TABLE public.scheduled_demos
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_1h_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_by_customer_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_response text;

CREATE INDEX IF NOT EXISTS scheduled_demos_pending_24h_reminder_idx
  ON public.scheduled_demos(scheduled_at, reminder_24h_sent_at)
  WHERE reminder_24h_sent_at IS NULL AND status = 'scheduled';

CREATE INDEX IF NOT EXISTS scheduled_demos_pending_1h_reminder_idx
  ON public.scheduled_demos(scheduled_at, reminder_1h_sent_at)
  WHERE reminder_1h_sent_at IS NULL AND status = 'scheduled';
