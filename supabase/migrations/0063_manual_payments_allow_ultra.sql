-- Allow Ultra on manual_payments.plan (already applied on prod; idempotent).

ALTER TABLE public.manual_payments
  DROP CONSTRAINT IF EXISTS manual_payments_plan_check;

ALTER TABLE public.manual_payments
  ADD CONSTRAINT manual_payments_plan_check
  CHECK (plan = ANY (ARRAY[
    'starter'::text,
    'professional'::text,
    'clinic'::text,
    'ultra'::text
  ]));
