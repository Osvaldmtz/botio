ALTER TABLE public.scheduled_demos
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_error text,
  ADD COLUMN IF NOT EXISTS whatsapp_error text,
  ADD COLUMN IF NOT EXISTS reminder_24h_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_1h_email_sent_at timestamptz;

ALTER TABLE public.demo_bookings
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_error text,
  ADD COLUMN IF NOT EXISTS whatsapp_error text,
  ADD COLUMN IF NOT EXISTS reminder_24h_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_1h_email_sent_at timestamptz;
