-- Track welcome message delivery on trial onboarding enrollment.

ALTER TABLE public.trial_onboarding_messages
  ADD COLUMN IF NOT EXISTS welcome_msg_status text,
  ADD COLUMN IF NOT EXISTS welcome_msg_method text;
