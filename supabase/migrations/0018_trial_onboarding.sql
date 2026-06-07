-- Trial onboarding drip messages (days 1, 3, 7, 13, 15).

CREATE TABLE IF NOT EXISTS public.trial_onboarding_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone text NOT NULL,
  trial_user_email text NOT NULL,
  trial_user_name text,
  trial_started_at timestamptz NOT NULL,
  trial_ends_at timestamptz NOT NULL,
  conversation_id uuid REFERENCES public.conversations(id),
  day_1_sent_at timestamptz,
  day_3_sent_at timestamptz,
  day_7_sent_at timestamptz,
  day_13_sent_at timestamptz,
  day_15_sent_at timestamptz,
  customer_responded boolean DEFAULT false,
  upgraded_to_paid_at timestamptz,
  unsubscribed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trial_onboarding_phone_idx
  ON public.trial_onboarding_messages(customer_phone);

CREATE INDEX IF NOT EXISTS trial_onboarding_email_idx
  ON public.trial_onboarding_messages(trial_user_email);

CREATE INDEX IF NOT EXISTS trial_onboarding_pending_day1_idx
  ON public.trial_onboarding_messages(trial_started_at, day_1_sent_at)
  WHERE day_1_sent_at IS NULL AND unsubscribed = false AND upgraded_to_paid_at IS NULL;

CREATE INDEX IF NOT EXISTS trial_onboarding_pending_day3_idx
  ON public.trial_onboarding_messages(trial_started_at, day_3_sent_at)
  WHERE day_3_sent_at IS NULL AND unsubscribed = false AND upgraded_to_paid_at IS NULL;

CREATE INDEX IF NOT EXISTS trial_onboarding_pending_day7_idx
  ON public.trial_onboarding_messages(trial_started_at, day_7_sent_at)
  WHERE day_7_sent_at IS NULL AND unsubscribed = false AND upgraded_to_paid_at IS NULL;

CREATE INDEX IF NOT EXISTS trial_onboarding_pending_day13_idx
  ON public.trial_onboarding_messages(trial_started_at, day_13_sent_at)
  WHERE day_13_sent_at IS NULL AND unsubscribed = false AND upgraded_to_paid_at IS NULL;

CREATE INDEX IF NOT EXISTS trial_onboarding_pending_day15_idx
  ON public.trial_onboarding_messages(trial_started_at, day_15_sent_at)
  WHERE day_15_sent_at IS NULL AND unsubscribed = false AND upgraded_to_paid_at IS NULL;

ALTER TABLE public.trial_onboarding_messages ENABLE ROW LEVEL SECURITY;
