-- Admin reschedules stay active: they still occupy a slot and still receive reminders.
ALTER TABLE public.demo_bookings
  DROP CONSTRAINT IF EXISTS demo_bookings_status_check;

ALTER TABLE public.demo_bookings
  ADD CONSTRAINT demo_bookings_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled'::text, 'rescheduled_by_admin'::text]));
