-- Google Calendar demo scheduling (OAuth credentials + booked demos).

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.calendar_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_email text NOT NULL UNIQUE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  scopes text[] DEFAULT ARRAY[]::text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scheduled_demos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id),
  bot_id uuid REFERENCES public.bots(id),
  customer_email text NOT NULL,
  customer_name text NOT NULL,
  customer_phone text,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer DEFAULT 15,
  google_event_id text,
  google_meet_link text,
  status text DEFAULT 'scheduled',
  notes text,
  created_at timestamptz DEFAULT now(),
  cancelled_at timestamptz,
  cancellation_reason text
);

CREATE INDEX IF NOT EXISTS scheduled_demos_conversation_idx
  ON public.scheduled_demos(conversation_id);

CREATE INDEX IF NOT EXISTS scheduled_demos_scheduled_at_idx
  ON public.scheduled_demos(scheduled_at);

ALTER TABLE public.calendar_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_demos ENABLE ROW LEVEL SECURITY;
