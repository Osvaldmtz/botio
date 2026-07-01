-- CAC 30d (primary) + all-time LTV:CAC metrics on daily Kalyo sync snapshots

alter table kalyo_metrics add column if not exists cac_usd numeric(10,2);
alter table kalyo_metrics add column if not exists cac_usd_alltime numeric(10,2);
alter table kalyo_metrics add column if not exists ltv_cac_ratio_alltime numeric(5,2);
alter table kalyo_metrics add column if not exists new_subscribers_30d int default 0;
alter table kalyo_metrics add column if not exists total_paying_customers int default 0;
alter table kalyo_metrics add column if not exists ad_spend_30d_mxn numeric(12,2);
alter table kalyo_metrics add column if not exists ad_spend_alltime_mxn numeric(12,2);
