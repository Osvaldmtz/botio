-- ML del Pobre roadmap reminders (Fases 3–5)

CREATE TABLE IF NOT EXISTS public.roadmap_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('date', 'metric', 'both')),
  trigger_date TIMESTAMPTZ,
  trigger_metric TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'notified', 'completed', 'dismissed')),
  notified_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roadmap_reminders_status
  ON public.roadmap_reminders (status)
  WHERE status = 'pending';

INSERT INTO public.roadmap_reminders (title, description, trigger_type, trigger_date, trigger_metric)
VALUES
  (
    'ML Fase 3 — A/B testing automatizado',
    'Implementar sistema que aplica automáticamente insights de Fase 2 al system prompt vía variantes A/B. Requiere ~3 meses de datos.',
    'both',
    NOW() + INTERVAL '90 days',
    'conversations_with_outcome >= 200'
  ),
  (
    'ML Fase 4 — Fine-tuning Claude',
    'Fine-tunear Claude con conversaciones exitosas de Kalyo. Costo: $1-3K. Requiere 500+ conversaciones convertidas.',
    'both',
    NOW() + INTERVAL '180 days',
    'paid_conversions >= 500'
  ),
  (
    'ML Fase 5 — MLOps real',
    'Sistema ML completo con MLOps. Solo justificable con 1000+ clientes pagando.',
    'metric',
    NULL,
    'active_paid_subscribers >= 1000'
  );
