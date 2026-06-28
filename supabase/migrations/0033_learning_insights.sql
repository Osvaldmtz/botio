-- ML del Pobre Fase 2 prep: learning_insights table (populated later by weekly Claude analysis)

CREATE TABLE IF NOT EXISTS public.learning_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  total_conversations INT,
  paid_count INT,
  trial_count INT,
  lost_count INT,
  insights JSONB,
  applied BOOLEAN DEFAULT false,
  applied_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_learning_insights_generated_at
  ON public.learning_insights (generated_at DESC);
