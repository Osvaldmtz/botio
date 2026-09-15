-- Demo WhatsApp slots: default duration aligned with product copy (30 min).
ALTER TABLE public.scheduled_demos
  ALTER COLUMN duration_minutes SET DEFAULT 30;
