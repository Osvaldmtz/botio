-- Stripe-sourced daily snapshot (alongside Kalyo psychologists MRR)
alter table public.kalyo_metrics
  add column if not exists stripe_mrr numeric default null,
  add column if not exists stripe_active integer default null,
  add column if not exists stripe_churned_30d integer default null,
  add column if not exists stripe_churn_rate numeric default null,
  add column if not exists stripe_mrr_lost_30d numeric default null,
  add column if not exists past_due_actionable integer default null;

comment on column public.kalyo_metrics.stripe_mrr is 'MRR USD from Stripe API at sync time';
comment on column public.kalyo_metrics.stripe_churn_rate is 'Stripe canceled_30d / (active+canceled) * 100';
