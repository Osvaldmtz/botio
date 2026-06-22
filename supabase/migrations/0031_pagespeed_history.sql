create table if not exists pagespeed_history (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  performance_mobile int,
  performance_desktop int,
  lcp_mobile numeric(5,2),
  fcp_mobile numeric(5,2),
  cls_mobile numeric(5,3),
  tbt_mobile int,
  seo_mobile int,
  synced_at timestamptz default now()
);

create index if not exists idx_pagespeed_history_date on pagespeed_history(date desc);
