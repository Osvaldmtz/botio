-- SaaS LTV / churn metrics on daily Kalyo sync snapshots

alter table kalyo_metrics add column if not exists churned_30d int default 0;
alter table kalyo_metrics add column if not exists churn_rate numeric(5,2) default 0;
alter table kalyo_metrics add column if not exists ltv_avg numeric(10,2) default 0;
alter table kalyo_metrics add column if not exists ltv_cac_ratio numeric(5,2) default 0;
