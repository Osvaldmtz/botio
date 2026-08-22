-- Congreso trials: store generated login credentials.

ALTER TABLE public.congreso_trials
  ADD COLUMN IF NOT EXISTS generated_password text,
  ADD COLUMN IF NOT EXISTS account_created_at timestamptz;
