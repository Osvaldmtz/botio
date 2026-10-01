ALTER TABLE public.scheduled_demos
  ADD COLUMN IF NOT EXISTS confirmation_sent boolean;

ALTER TABLE public.demo_bookings
  ADD COLUMN IF NOT EXISTS confirmation_sent boolean;
