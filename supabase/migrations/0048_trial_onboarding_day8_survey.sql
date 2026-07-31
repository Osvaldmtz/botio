-- Day 8 post-trial survey (192h after enroll) + welcome retry tracking.

ALTER TABLE public.trial_onboarding_messages
  ADD COLUMN IF NOT EXISTS day_8_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS day_8_response text;

CREATE INDEX IF NOT EXISTS trial_onboarding_pending_day8_idx
  ON public.trial_onboarding_messages(trial_started_at, day_8_sent_at)
  WHERE day_8_sent_at IS NULL AND unsubscribed = false AND upgraded_to_paid_at IS NULL;
