-- Patient WhatsApp messages redirected to psychologist (bypass Sofía sales flow)

CREATE TABLE IF NOT EXISTS public.patient_inbound_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  bot_id uuid,
  patient_phone text NOT NULL,
  patient_id uuid,
  patient_name text,
  psychologist_id uuid,
  psychologist_phone text,
  message_preview text,
  psychologist_notified boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_patient_inbound_events_created_at
  ON public.patient_inbound_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_patient_inbound_events_psychologist_id
  ON public.patient_inbound_events (psychologist_id)
  WHERE psychologist_id IS NOT NULL;

ALTER TABLE public.patient_inbound_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_public_read" ON public.patient_inbound_events
  FOR ALL USING (false);
