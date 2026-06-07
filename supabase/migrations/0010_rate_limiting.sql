-- Rate limiting: track inbound message velocity per phone and audit blocks.

CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone text NOT NULL,
  bot_id uuid REFERENCES public.bots(id),
  event_type text NOT NULL DEFAULT 'message',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limit_phone_time_idx
  ON public.rate_limit_events (customer_phone, created_at DESC);

-- Supports hourly cleanup deletes by created_at (partial indexes cannot use now()).
CREATE INDEX IF NOT EXISTS rate_limit_cleanup_idx
  ON public.rate_limit_events (created_at);

CREATE TABLE IF NOT EXISTS public.rate_limit_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone text NOT NULL,
  bot_id uuid REFERENCES public.bots(id),
  blocked_at timestamptz DEFAULT now(),
  messages_count integer NOT NULL,
  reason text DEFAULT 'rate_exceeded',
  conversation_id uuid REFERENCES public.conversations(id)
);

CREATE INDEX IF NOT EXISTS rate_limit_blocks_phone_idx
  ON public.rate_limit_blocks (customer_phone, blocked_at DESC);
