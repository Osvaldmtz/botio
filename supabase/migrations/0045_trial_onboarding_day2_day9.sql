-- Trial onboarding: day 2 drip + day 9 PRIMER50 follow-up.
-- Legacy columns day_7/day_13/day_15 map to narrative days 5/6/7; day_1 = welcome at enroll.

ALTER TABLE public.trial_onboarding_messages
  ADD COLUMN IF NOT EXISTS day_2_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS day_9_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS day_9_status text;

CREATE INDEX IF NOT EXISTS trial_onboarding_pending_day2_idx
  ON public.trial_onboarding_messages(trial_started_at, day_2_sent_at)
  WHERE day_2_sent_at IS NULL AND unsubscribed = false AND upgraded_to_paid_at IS NULL;

CREATE INDEX IF NOT EXISTS trial_onboarding_pending_day9_idx
  ON public.trial_onboarding_messages(trial_started_at, day_9_sent_at)
  WHERE day_9_sent_at IS NULL AND unsubscribed = false AND upgraded_to_paid_at IS NULL;
