import 'server-only';
import { subDays, format } from 'date-fns';
import { createAdminClient } from '@/lib/supabase/admin';
import type {
  PageSpeedCompactScores,
  PageSpeedHistoryRow,
  PageSpeedMetrics,
  PageSpeedScores,
} from '@/lib/pagespeed-utils';

const PAGESPEED_API = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const CACHE_KEY = 'pagespeed';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

const LANDING_URL = 'https://kalyo.io';
const ARTICLE_URL = 'https://kalyo.io/articulos/que-es-el-phq-9.html';
const APP_URL = 'https://app.kalyo.io';

export type {
  PageSpeedCompactScores,
  PageSpeedHistoryRow,
  PageSpeedMetrics,
  PageSpeedScores,
  VitalsStatus,
} from '@/lib/pagespeed-utils';
export {
  clsStatus,
  fcpStatus,
  lcpStatus,
  performanceAccent,
  tbtStatus,
  vitalsStatusLabel,
} from '@/lib/pagespeed-utils';

type LighthouseCategory = { score?: number | null };
type LighthouseAudit = { numericValue?: number | null };

type PageSpeedApiResponse = {
  lighthouseResult?: {
    categories?: Record<string, LighthouseCategory>;
    audits?: Record<string, LighthouseAudit>;
  };
  error?: { message?: string };
};

function scorePct(category?: LighthouseCategory): number {
  const raw = category?.score;
  if (raw == null || !Number.isFinite(raw)) return 0;
  return Math.round(raw * 100);
}

function auditMs(audits: Record<string, LighthouseAudit> | undefined, id: string): number {
  const value = audits?.[id]?.numericValue;
  return value != null && Number.isFinite(value) ? value : 0;
}

function parseFullResult(json: PageSpeedApiResponse): PageSpeedScores {
  const categories = json.lighthouseResult?.categories ?? {};
  const audits = json.lighthouseResult?.audits ?? {};

  return {
    performance: scorePct(categories.performance),
    seo: scorePct(categories.seo),
    accessibility: scorePct(categories.accessibility),
    best_practices: scorePct(categories['best-practices']),
    lcp: Math.round((auditMs(audits, 'largest-contentful-paint') / 1000) * 100) / 100,
    fcp: Math.round((auditMs(audits, 'first-contentful-paint') / 1000) * 100) / 100,
    cls: Math.round(auditMs(audits, 'cumulative-layout-shift') * 1000) / 1000,
    tbt: Math.round(auditMs(audits, 'total-blocking-time')),
  };
}

function parseCompactResult(json: PageSpeedApiResponse): PageSpeedCompactScores {
  const full = parseFullResult(json);
  return {
    performance: full.performance,
    seo: full.seo,
    lcp: full.lcp,
  };
}

async function readCache(): Promise<PageSpeedMetrics | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('meta_cache')
    .select('payload, expires_at')
    .eq('cache_key', CACHE_KEY)
    .maybeSingle();

  if (!data?.payload || !data.expires_at) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) return null;
  return data.payload as PageSpeedMetrics;
}

async function writeCache(metrics: PageSpeedMetrics): Promise<void> {
  const supabase = createAdminClient();
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();
  await supabase.from('meta_cache').upsert(
    {
      cache_key: CACHE_KEY,
      payload: metrics as unknown as Record<string, unknown>,
      cached_at: new Date().toISOString(),
      expires_at: expiresAt,
    },
    { onConflict: 'cache_key' },
  );
}

async function runPageSpeed(url: string, strategy: 'mobile' | 'desktop'): Promise<PageSpeedApiResponse> {
  const params = new URLSearchParams({ url, strategy });
  const key = process.env.PAGESPEED_API_KEY?.trim();
  if (key) params.set('key', key);

  const res = await fetch(`${PAGESPEED_API}?${params}`, { next: { revalidate: 0 } });
  const json = (await res.json()) as PageSpeedApiResponse;

  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `PageSpeed API error (${res.status}) for ${url}`);
  }

  return json;
}

async function fetchAllMetrics(): Promise<PageSpeedMetrics> {
  const [landingMobile, landingDesktop, articleMobile, appMobile] = await Promise.all([
    runPageSpeed(LANDING_URL, 'mobile'),
    runPageSpeed(LANDING_URL, 'desktop'),
    runPageSpeed(ARTICLE_URL, 'mobile'),
    runPageSpeed(APP_URL, 'mobile'),
  ]);

  return {
    landing_mobile: parseFullResult(landingMobile),
    landing_desktop: parseFullResult(landingDesktop),
    article_mobile: parseCompactResult(articleMobile),
    app_mobile: parseCompactResult(appMobile),
    updated_at: new Date().toISOString(),
  };
}

export async function getPageSpeedMetrics(options?: {
  skipCache?: boolean;
}): Promise<PageSpeedMetrics> {
  if (!options?.skipCache) {
    const cached = await readCache();
    if (cached) return cached;
  }

  const metrics = await fetchAllMetrics();
  await writeCache(metrics);
  return metrics;
}

export async function getPageSpeedHistory(days = 30): Promise<PageSpeedHistoryRow[]> {
  const supabase = createAdminClient();
  const since = format(subDays(new Date(), days), 'yyyy-MM-dd');

  const { data, error } = await supabase
    .from('pagespeed_history')
    .select(
      'date, performance_mobile, performance_desktop, lcp_mobile, fcp_mobile, cls_mobile, tbt_mobile, seo_mobile',
    )
    .gte('date', since)
    .order('date', { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    date: String(row.date),
    performance_mobile: row.performance_mobile,
    performance_desktop: row.performance_desktop,
    lcp_mobile: row.lcp_mobile != null ? Number(row.lcp_mobile) : null,
    fcp_mobile: row.fcp_mobile != null ? Number(row.fcp_mobile) : null,
    cls_mobile: row.cls_mobile != null ? Number(row.cls_mobile) : null,
    tbt_mobile: row.tbt_mobile,
    seo_mobile: row.seo_mobile,
  }));
}

export async function syncPageSpeedMetrics(): Promise<{
  date: string;
  performance_mobile: number;
  performance_desktop: number;
}> {
  const [mobile, desktop] = await Promise.all([
    runPageSpeed(LANDING_URL, 'mobile'),
    runPageSpeed(LANDING_URL, 'desktop'),
  ]);

  const mobileScores = parseFullResult(mobile);
  const desktopScores = parseFullResult(desktop);
  const dateStr = format(new Date(), 'yyyy-MM-dd');

  const supabase = createAdminClient();
  const { error } = await supabase.from('pagespeed_history').upsert(
    {
      date: dateStr,
      performance_mobile: mobileScores.performance,
      performance_desktop: desktopScores.performance,
      lcp_mobile: mobileScores.lcp,
      fcp_mobile: mobileScores.fcp,
      cls_mobile: mobileScores.cls,
      tbt_mobile: mobileScores.tbt,
      seo_mobile: mobileScores.seo,
      synced_at: new Date().toISOString(),
    },
    { onConflict: 'date' },
  );

  if (error) throw new Error(error.message);

  return {
    date: dateStr,
    performance_mobile: mobileScores.performance,
    performance_desktop: desktopScores.performance,
  };
}
