export type GscPeriodDays = 7 | 14 | 28;

export const GSC_PERIOD_OPTIONS: GscPeriodDays[] = [7, 14, 28];

export type GscTopQuery = {
  query: string;
  clicks: number;
  position: number;
};

export type GscTopPage = {
  page: string;
  clicks: number;
  position: number;
};

export type GscDailyClick = {
  date: string;
  clicks: number;
};

export type GscMetrics = {
  period_days: GscPeriodDays;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  top_queries: GscTopQuery[];
  top_pages: GscTopPage[];
  daily_clicks: GscDailyClick[];
  updated_at: string;
};

export function parseGscPeriod(value: string | null | undefined): GscPeriodDays {
  const n = Number(value);
  if (n === 7 || n === 14 || n === 28) return n;
  return 28;
}
