-- KPI dashboard: Twilio, Kalyo MRR, Meta API cache

create table if not exists twilio_metrics (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  phone_number text not null,
  phone_label text,
  total_sent int default 0,
  delivered int default 0,
  failed int default 0,
  undelivered int default 0,
  delivery_rate numeric(5,2),
  total_cost_usd numeric(10,4),
  synced_at timestamptz default now(),
  unique(date, phone_number)
);

create table if not exists kalyo_metrics (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  mrr numeric(10,2),
  active_subscribers int,
  trialing int,
  converted_today int,
  churned_today int,
  plan_pro int,
  plan_max int,
  synced_at timestamptz default now()
);

create table if not exists meta_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,
  payload jsonb,
  cached_at timestamptz default now(),
  expires_at timestamptz
);

create index if not exists idx_twilio_metrics_date on twilio_metrics(date desc);
create index if not exists idx_kalyo_metrics_date on kalyo_metrics(date desc);
create index if not exists idx_meta_cache_expires on meta_cache(expires_at);
