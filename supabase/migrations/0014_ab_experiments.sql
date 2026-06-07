-- A/B testing infrastructure for prompt and message experiments.

CREATE TABLE IF NOT EXISTS public.ab_experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  bot_id uuid REFERENCES public.bots(id),
  scope text NOT NULL DEFAULT 'first_message',
  status text NOT NULL DEFAULT 'active',
  variants jsonb NOT NULL,
  traffic_split jsonb DEFAULT '{"A": 0.5, "B": 0.5}'::jsonb,
  created_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  winner_variant text,
  min_sample_size integer DEFAULT 50
);

CREATE INDEX IF NOT EXISTS ab_experiments_status_idx
  ON public.ab_experiments (status)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.ab_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES public.ab_experiments(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  variant text NOT NULL,
  assigned_at timestamptz DEFAULT now(),
  UNIQUE (experiment_id, conversation_id)
);

CREATE INDEX IF NOT EXISTS ab_assignments_exp_conv_idx
  ON public.ab_assignments (experiment_id, conversation_id);

CREATE TABLE IF NOT EXISTS public.ab_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.ab_assignments(id) ON DELETE CASCADE,
  outcome_type text NOT NULL,
  outcome_value jsonb,
  recorded_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ab_outcomes_assignment_idx
  ON public.ab_outcomes (assignment_id);

INSERT INTO public.ab_experiments (
  name,
  description,
  bot_id,
  scope,
  variants,
  min_sample_size
)
VALUES (
  'Primer mensaje — corto vs llamativo',
  'Probar si un primer mensaje más llamativo convierte mejor que el actual',
  '64f6eed2-1522-48fe-a2c6-f858b767df06',
  'first_message',
  '{
    "A": {
      "first_message": "¡Hola! Soy Sofía de Kalyo 👋 Ayudamos a psicólogos a evaluar pacientes con +100 pruebas clínicas validadas, todo desde el navegador. ¿Qué te gustaría saber primero: evaluaciones, precios, o cómo funciona la prueba gratis?"
    },
    "B": {
      "first_message": "¡Hola psicólogo/a! 👋 Tenemos +100 evaluaciones validadas y reportes con IA. ¿Quieres probar 15 días gratis sin tarjeta, agendar una demo en vivo con Osvaldo, o que te cuente más?"
    }
  }'::jsonb,
  50
)
ON CONFLICT (name) DO NOTHING;
