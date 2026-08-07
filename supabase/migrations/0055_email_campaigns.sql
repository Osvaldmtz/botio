-- Campaigns + automations; extend email_logs for campaign sends

CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  segment TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_campaigns_status
  ON public.email_campaigns (status);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_scheduled
  ON public.email_campaigns (scheduled_at)
  WHERE status = 'scheduled';

CREATE TABLE IF NOT EXISTS public.email_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL,
  delay_days INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Extend logs for campaigns (sequence optional)
ALTER TABLE public.email_logs
  ALTER COLUMN sequence_id DROP NOT NULL;

ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.email_campaigns (id) ON DELETE SET NULL;

ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS campaign_name TEXT;

ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Allow error status
ALTER TABLE public.email_logs DROP CONSTRAINT IF EXISTS email_logs_status_check;
ALTER TABLE public.email_logs
  ADD CONSTRAINT email_logs_status_check
  CHECK (status IN ('sent', 'opened', 'bounced', 'error'));

CREATE INDEX IF NOT EXISTS idx_email_logs_campaign_id
  ON public.email_logs (campaign_id);

DROP TRIGGER IF EXISTS email_campaigns_updated_at ON public.email_campaigns;
CREATE TRIGGER email_campaigns_updated_at
  BEFORE UPDATE ON public.email_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.emailing_set_updated_at();

DROP TRIGGER IF EXISTS email_automations_updated_at ON public.email_automations;
CREATE TRIGGER email_automations_updated_at
  BEFORE UPDATE ON public.email_automations
  FOR EACH ROW EXECUTE FUNCTION public.emailing_set_updated_at();

ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_automations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_public_read" ON public.email_campaigns;
CREATE POLICY "deny_public_read" ON public.email_campaigns
  FOR SELECT USING (false);

DROP POLICY IF EXISTS "deny_public_read" ON public.email_automations;
CREATE POLICY "deny_public_read" ON public.email_automations
  FOR SELECT USING (false);

INSERT INTO public.email_automations (key, name, description, trigger_type, delay_days, active)
VALUES
  (
    'welcome_paid',
    'Bienvenida plan Pro/Max',
    'Envía welcome-transactional al convertirse en Pro o Max (Stripe webhook).',
    'stripe_subscription_active',
    0,
    true
  ),
  (
    'onboarding_trial',
    'Onboarding trial',
    'Secuencia de días al enrolarse en trial (trigger trial-activo).',
    'trial_enrollment',
    0,
    true
  ),
  (
    'recovery_cancelled',
    'Recuperación cancelados',
    'Email de recuperación 3 días después de cancelar la suscripción.',
    'subscription_cancelled',
    3,
    true
  )
ON CONFLICT (key) DO NOTHING;

-- Welcome transactional is for paid Pro/Max (Stripe), not trial enroll
UPDATE public.email_sequences
SET
  trigger_tag = 'subscription-activo',
  cancel_on_tag = NULL,
  name = 'Bienvenida plan Pro/Max'
WHERE id = 'a0000001-0000-4000-8000-000000000001';

-- Recovery sequence (used by automation jobs)
INSERT INTO public.email_sequences (
  id, name, trigger_tag, cancel_on_tag, delay_days, subject, html_template, active, sort_order
) VALUES (
  'a0000001-0000-4000-8000-000000000007',
  'Recuperación cancelados',
  'subscription-cancelado',
  'trial-convertido',
  3,
  'Te extrañamos en Kalyo',
  $html$<!DOCTYPE html><html lang="es"><body style="font-family:Arial,sans-serif;color:#1A1B2E;padding:24px;">
<p>Hola{{name}},</p>
<p>Notamos que cancelaste tu suscripción. Si fue un error o quieres volver, estamos aquí para ayudarte.</p>
<p><a href="https://app.kalyo.io/login" style="display:inline-block;background:#8C52FF;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">Volver a Kalyo</a></p>
<p style="color:#5C6380;font-size:13px;">— El equipo de Kalyo · hola@kalyo.io</p>
</body></html>$html$,
  true,
  7
) ON CONFLICT (id) DO NOTHING;
