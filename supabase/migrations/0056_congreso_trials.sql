-- Congreso — Plan MAX 30 días gratis (onboarding drip).

CREATE TABLE IF NOT EXISTS public.congreso_trials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  customer_phone text NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  bot_id text NOT NULL,
  activated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  day_1_sent_at timestamptz,
  day_2_sent_at timestamptz,
  day_3_sent_at timestamptz,
  day_5_sent_at timestamptz,
  day_7_sent_at timestamptz,
  day_10_sent_at timestamptz,
  day_12_sent_at timestamptz,
  day_14_sent_at timestamptz,
  day_17_sent_at timestamptz,
  day_20_sent_at timestamptz,
  day_21_sent_at timestamptz,
  day_25_sent_at timestamptz,
  day_28_sent_at timestamptz,
  day_29_sent_at timestamptz,
  day_30_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS congreso_trials_phone_bot_idx
  ON public.congreso_trials(customer_phone, bot_id);

CREATE INDEX IF NOT EXISTS congreso_trials_expires_idx
  ON public.congreso_trials(expires_at);

ALTER TABLE public.congreso_trials ENABLE ROW LEVEL SECURITY;
