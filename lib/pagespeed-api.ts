import 'server-only';
import { subDays, format } from 'date-fns';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  ensureValidUrl,
  type PageSpeedCompactScores,
  type PageSpeedHistoryRow,
  type PageSpeedMetrics,
  type PageSpeedScores,
} from '@/lib/pagespeed-utils';

const PAGESPEED_API = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const CACHE_KEY = 'pagespeed';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

function resolvePageSpeedUrls(): { landing: string; article: string; app: string } {
  const landing = ensureValidUrl(process.env.KALYO_SITE_URL?.trim() || 'kalyo.io');
  const app = ensureValidUrl(process.env.KALYO_APP_URL?.trim() || 'app.kalyo.io');
  const articleRaw = process.env.KALYO_PAGESPEED_ARTICLE_URL?.trim();
  const article = articleRaw
    ? ensureValidUrl(articleRaw)
    : `${landing.replace(/\/$/, '')}/articulos/que-es-el-phq-9.html`;
  return { landing, article, app };
}

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
    runtimeError?: { code?: string; message?: string };
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

async function readCache(ignoreExpiry = false): Promise<PageSpeedMetrics | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('meta_cache')
    .select('payload, expires_at')
    .eq('cache_key', CACHE_KEY)
    .maybeSingle();

  if (!data?.payload) return null;
  if (!ignoreExpiry && data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
    return null;
  }
  return data.payload as PageSpeedMetrics;
}

/** Read cache only — never calls PageSpeed API (safe for page load). */
export async function getPageSpeedMetricsCached(): Promise<PageSpeedMetrics | null> {
  return readCache(false) ?? readCache(true);
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
  const validUrl = ensureValidUrl(url);
  const key = process.env.PAGESPEED_API_KEY?.trim();
  if (!key) {
    throw new Error(
      'PAGESPEED_API_KEY no configurada en Vercel. Crea una API key en Google Cloud (PageSpeed Insights API) y agrégala como env var.',
    );
  }

  const query = new URLSearchParams({
    url: validUrl,
    strategy,
    key,
  });
  for (const category of ['performance', 'seo', 'accessibility', 'best-practices'] as const) {
    query.append('category', category);
  }
  const res = await fetch(`${PAGESPEED_API}?${query}`, { next: { revalidate: 0 } });
  const json = (await res.json()) as PageSpeedApiResponse;

  if (!res.ok || json.error) {
    const msg = json.error?.message ?? `PageSpeed API error (${res.status}) for ${validUrl}`;
    if (/quota exceeded/i.test(msg)) {
      throw new Error(
        `${msg} — Cuota diaria agotada. Espera al reset (medianoche PT) o usa otra API key en PAGESPEED_API_KEY.`,
      );
    }
    throw new Error(msg);
  }

  const runtimeError = json.lighthouseResult?.runtimeError;
  if (runtimeError?.message) {
    throw new Error(`Lighthouse error for ${validUrl}: ${runtimeError.message}`);
  }

  return json;
}

async function fetchAllMetrics(): Promise<PageSpeedMetrics> {
  const { landing, article, app } = resolvePageSpeedUrls();
  const [landingMobile, landingDesktop, articleMobile, appMobile] = await Promise.all([
    runPageSpeed(landing, 'mobile'),
    runPageSpeed(landing, 'desktop'),
    runPageSpeed(article, 'mobile'),
    runPageSpeed(app, 'mobile'),
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
    const cached = await readCache(false);
    if (cached) return cached;
    throw new Error(
      'Sin datos en caché. Pulsa «Actualizar ahora» (requiere PAGESPEED_API_KEY) o espera al cron diario.',
    );
  }

  try {
    const metrics = await fetchAllMetrics();
    await writeCache(metrics);
    return metrics;
  } catch (error) {
    const stale = await readCache(true);
    if (stale) return stale;
    throw error;
  }
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
  const { landing } = resolvePageSpeedUrls();
  const [mobile, desktop] = await Promise.all([
    runPageSpeed(landing, 'mobile'),
    runPageSpeed(landing, 'desktop'),
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
