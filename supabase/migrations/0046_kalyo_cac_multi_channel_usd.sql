-- Multi-channel CAC: Meta (MXN) + Google Ads (COP) normalized to USD

alter table kalyo_metrics add column if not exists ad_spend_30d_usd numeric(12,2);
alter table kalyo_metrics add column if not exists ad_spend_alltime_usd numeric(12,2);
alter table kalyo_metrics add column if not exists meta_spend_30d_usd numeric(12,2);
alter table kalyo_metrics add column if not exists google_spend_30d_usd numeric(12,2);
alter table kalyo_metrics add column if not exists meta_spend_alltime_usd numeric(12,2);
alter table kalyo_metrics add column if not exists google_spend_alltime_usd numeric(12,2);
alter table kalyo_metrics add column if not exists fx_mxn_per_usd numeric(12,4);
alter table kalyo_metrics add column if not exists fx_cop_per_usd numeric(12,4);
