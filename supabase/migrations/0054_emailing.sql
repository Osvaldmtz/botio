-- Emailing (Resend): sequences, logs, delayed jobs

CREATE TABLE IF NOT EXISTS public.email_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  trigger_tag TEXT NOT NULL,
  cancel_on_tag TEXT,
  delay_days INTEGER NOT NULL DEFAULT 0 CHECK (delay_days >= 0),
  subject TEXT NOT NULL,
  html_template TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_sequences_trigger_tag
  ON public.email_sequences (trigger_tag);
CREATE INDEX IF NOT EXISTS idx_email_sequences_sort
  ON public.email_sequences (sort_order);

CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email TEXT NOT NULL,
  sequence_id UUID NOT NULL REFERENCES public.email_sequences (id) ON DELETE CASCADE,
  resend_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'opened', 'bounced')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON public.email_logs (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_resend_id ON public.email_logs (resend_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_sequence_id ON public.email_logs (sequence_id);

CREATE TABLE IF NOT EXISTS public.email_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email TEXT NOT NULL,
  sequence_id UUID NOT NULL REFERENCES public.email_sequences (id) ON DELETE CASCADE,
  psychologist_name TEXT,
  run_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_jobs_due
  ON public.email_jobs (run_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_email_jobs_to_email
  ON public.email_jobs (to_email);

CREATE OR REPLACE FUNCTION public.emailing_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS email_sequences_updated_at ON public.email_sequences;
CREATE TRIGGER email_sequences_updated_at
  BEFORE UPDATE ON public.email_sequences
  FOR EACH ROW EXECUTE FUNCTION public.emailing_set_updated_at();

DROP TRIGGER IF EXISTS email_jobs_updated_at ON public.email_jobs;
CREATE TRIGGER email_jobs_updated_at
  BEFORE UPDATE ON public.email_jobs
  FOR EACH ROW EXECUTE FUNCTION public.emailing_set_updated_at();

ALTER TABLE public.email_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_public_read" ON public.email_sequences;
CREATE POLICY "deny_public_read" ON public.email_sequences
  FOR SELECT USING (false);

DROP POLICY IF EXISTS "deny_public_read" ON public.email_logs;
CREATE POLICY "deny_public_read" ON public.email_logs
  FOR SELECT USING (false);

DROP POLICY IF EXISTS "deny_public_read" ON public.email_jobs;
CREATE POLICY "deny_public_read" ON public.email_jobs
  FOR SELECT USING (false);

-- Seed 6 onboarding sequences (stable IDs)
INSERT INTO public.email_sequences (
  id, name, trigger_tag, cancel_on_tag, delay_days, subject, html_template, active, sort_order
) VALUES
(
  'a0000001-0000-4000-8000-000000000001',
  'Welcome',
  'trial-activo',
  NULL,
  0,
  'Bienvenido a Kalyo',
  $html$<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F4F5;font-family:Georgia,serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:#10B981;padding:24px 32px;">
          <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;font-family:system-ui,sans-serif;">Kalyo</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 12px;font-size:24px;color:#18181B;">¡Hola{{name}}!</h1>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#3F3F46;">
            Bienvenido a tu trial de Kalyo. Estamos aquí para ayudarte a gestionar tu consulta clínica con menos fricción.
          </p>
          <p style="margin:0;font-size:16px;line-height:1.6;color:#3F3F46;">
            Empieza completando tu perfil — te guiaremos paso a paso.
          </p>
        </td></tr>
        <tr><td style="padding:0 32px 32px;">
          <a href="https://kalyo.io" style="display:inline-block;background:#10B981;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-family:system-ui,sans-serif;font-size:14px;font-weight:600;">Ir a Kalyo</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>$html$,
  true,
  1
),
(
  'a0000001-0000-4000-8000-000000000002',
  'Completa tu perfil',
  'trial-activo',
  'onboarding-paso-1',
  2,
  'Completa tu perfil en Kalyo',
  $html$<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F4F5;font-family:Georgia,serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:#10B981;padding:24px 32px;">
          <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;font-family:system-ui,sans-serif;">Kalyo</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 12px;font-size:24px;color:#18181B;">{{name}}, completa tu perfil</h1>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#3F3F46;">
            Tu perfil es la base de tu consulta en Kalyo. Toma 2 minutos y desbloquea el resto del onboarding.
          </p>
        </td></tr>
        <tr><td style="padding:0 32px 32px;">
          <a href="https://kalyo.io" style="display:inline-block;background:#10B981;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-family:system-ui,sans-serif;font-size:14px;font-weight:600;">Completar perfil</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>$html$,
  true,
  2
),
(
  'a0000001-0000-4000-8000-000000000003',
  'Agrega un paciente',
  'trial-activo',
  'onboarding-paso-2',
  5,
  'Agrega tu primer paciente',
  $html$<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F4F5;font-family:Georgia,serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:#10B981;padding:24px 32px;">
          <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;font-family:system-ui,sans-serif;">Kalyo</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 12px;font-size:24px;color:#18181B;">Siguiente paso: tu primer paciente</h1>
          <p style="margin:0;font-size:16px;line-height:1.6;color:#3F3F46;">
            {{name}}, agrega un paciente de prueba o real para ver cómo Kalyo organiza tu práctica clínica.
          </p>
        </td></tr>
        <tr><td style="padding:0 32px 32px;">
          <a href="https://kalyo.io" style="display:inline-block;background:#10B981;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-family:system-ui,sans-serif;font-size:14px;font-weight:600;">Agregar paciente</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>$html$,
  true,
  3
),
(
  'a0000001-0000-4000-8000-000000000004',
  'Agenda tu primera cita',
  'trial-activo',
  'onboarding-paso-3',
  7,
  'Agenda tu primera cita en Kalyo',
  $html$<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F4F5;font-family:Georgia,serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:#10B981;padding:24px 32px;">
          <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;font-family:system-ui,sans-serif;">Kalyo</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 12px;font-size:24px;color:#18181B;">Agenda tu primera cita</h1>
          <p style="margin:0;font-size:16px;line-height:1.6;color:#3F3F46;">
            {{name}}, el calendario es el corazón de tu día a día. Agenda una cita y prueba el flujo completo.
          </p>
        </td></tr>
        <tr><td style="padding:0 32px 32px;">
          <a href="https://kalyo.io" style="display:inline-block;background:#10B981;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-family:system-ui,sans-serif;font-size:14px;font-weight:600;">Agendar cita</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>$html$,
  true,
  4
),
(
  'a0000001-0000-4000-8000-000000000005',
  '¡Conoce nuestros planes!',
  'onboarding-completo',
  NULL,
  7,
  'Conoce los planes de Kalyo',
  $html$<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F4F5;font-family:Georgia,serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:#10B981;padding:24px 32px;">
          <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;font-family:system-ui,sans-serif;">Kalyo</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 12px;font-size:24px;color:#18181B;">Ya completaste el onboarding</h1>
          <p style="margin:0;font-size:16px;line-height:1.6;color:#3F3F46;">
            {{name}}, exploraste lo esencial de Kalyo. Mira nuestros planes y elige el que mejor se adapte a tu consulta.
          </p>
        </td></tr>
        <tr><td style="padding:0 32px 32px;">
          <a href="https://kalyo.io" style="display:inline-block;background:#10B981;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-family:system-ui,sans-serif;font-size:14px;font-weight:600;">Ver planes</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>$html$,
  true,
  5
),
(
  'a0000001-0000-4000-8000-000000000006',
  'Oferta especial 30%',
  'trial-expirado',
  NULL,
  0,
  'Oferta especial: 30% en tu plan Kalyo',
  $html$<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F4F5;font-family:Georgia,serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:#10B981;padding:24px 32px;">
          <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;font-family:system-ui,sans-serif;">Kalyo</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 12px;font-size:24px;color:#18181B;">Tu trial terminó — 30% de descuento</h1>
          <p style="margin:0;font-size:16px;line-height:1.6;color:#3F3F46;">
            {{name}}, no pierdas el impulso. Activa un plan con 30% de descuento por tiempo limitado.
          </p>
        </td></tr>
        <tr><td style="padding:0 32px 32px;">
          <a href="https://kalyo.io" style="display:inline-block;background:#10B981;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-family:system-ui,sans-serif;font-size:14px;font-weight:600;">Activar oferta</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>$html$,
  true,
  6
)
ON CONFLICT (id) DO NOTHING;
