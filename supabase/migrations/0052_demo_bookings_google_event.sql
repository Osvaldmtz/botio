-- Track Google Calendar events for kalyo.io/demo bookings (written by Kalyo, calendar via Botio).

ALTER TABLE public.demo_bookings
  ADD COLUMN IF NOT EXISTS google_event_id text,
  ADD COLUMN IF NOT EXISTS google_meet_link text;

CREATE INDEX IF NOT EXISTS demo_bookings_google_event_id_idx
  ON public.demo_bookings (google_event_id)
  WHERE google_event_id IS NOT NULL;
