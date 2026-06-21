create table if not exists clarity_metrics (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  real_sessions int,
  bot_sessions int,
  bot_rate numeric(5,2),
  scroll_depth numeric(5,2),
  active_time_sec int,
  rage_clicks numeric(5,2),
  dead_clicks numeric(5,2),
  quick_backs numeric(5,2),
  pages_per_session numeric(5,2),
  synced_at timestamptz default now()
);

create index if not exists idx_clarity_metrics_date on clarity_metrics(date desc);
