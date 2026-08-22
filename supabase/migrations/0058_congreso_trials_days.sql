-- Congreso onboarding: keep only the 8 drip days (1, 3, 7, 12, 17, 25, 29, 30).

ALTER TABLE public.congreso_trials
  DROP COLUMN IF EXISTS day_2_sent_at,
  DROP COLUMN IF EXISTS day_5_sent_at,
  DROP COLUMN IF EXISTS day_10_sent_at,
  DROP COLUMN IF EXISTS day_14_sent_at,
  DROP COLUMN IF EXISTS day_20_sent_at,
  DROP COLUMN IF EXISTS day_21_sent_at,
  DROP COLUMN IF EXISTS day_28_sent_at;
