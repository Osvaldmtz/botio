-- Manual payments (Mercado Pago, transferencia, etc.) tracked in Botio for revenue metrics.

CREATE TABLE IF NOT EXISTS public.manual_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  psychologist_email TEXT NOT NULL,
  psychologist_name TEXT,
  amount_mxn NUMERIC(12, 2) NOT NULL CHECK (amount_mxn > 0),
  amount_usd NUMERIC(12, 2) CHECK (amount_usd IS NULL OR amount_usd > 0),
  platform TEXT NOT NULL
    CHECK (platform IN ('mercadopago', 'transferencia', 'otro')),
  plan TEXT NOT NULL
    CHECK (plan IN ('starter', 'professional', 'clinic')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT manual_payments_period_check CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS manual_payments_email_idx
  ON public.manual_payments (psychologist_email);

CREATE INDEX IF NOT EXISTS manual_payments_ends_at_idx
  ON public.manual_payments (ends_at);

ALTER TABLE public.manual_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_public_read" ON public.manual_payments;
CREATE POLICY "deny_public_read" ON public.manual_payments
  FOR SELECT USING (false);
