import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

const DATAFORSEO_API = 'https://api.dataforseo.com/v3';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 60_000;

export const SEO_DOMAIN = 'kalyo.io';
export const SEO_LANGUAGE_CODE = 'es';

export const SEO_PRIORITY_LOCATIONS = [
  { code: 2484, country: 'MX', label: 'México', flag: '🇲🇽' },
  { code: 2170, country: 'CO', label: 'Colombia', flag: '🇨🇴' },
  { code: 2032, country: 'AR', label: 'Argentina', flag: '🇦🇷' },
  { code: 2724, country: 'ES', label: 'España', flag: '🇪🇸' },
  { code: 2604, country: 'PE', label: 'Perú', flag: '🇵🇪' },
] as const;

export type SeoLocationCode = (typeof SEO_PRIORITY_LOCATIONS)[number]['code'];

type DataForSeoTask<T> = {
  id?: string;
  status_code?: number;
  status_message?: string;
  result?: T[] | null;
};

type DataForSeoResponse<T> = {
  status_code?: number;
  status_message?: string;
  tasks?: DataForSeoTask<T>[] | null;
};

type OrganicMetrics = {
  count?: number;
  etv?: number;
  pos_1?: number;
  pos_2_3?: number;
  pos_4_10?: number;
  pos_11_20?: number;
  pos_21_30?: number;
  pos_31_40?: number;
  pos_41_50?: number;
  pos_51_60?: number;
  pos_61_70?: number;
  pos_71_80?: number;
  pos_81_90?: number;
  pos_91_100?: number;
};

export type DomainOverviewResult = {
  target?: string;
  location_code?: number;
  metrics?: {
    organic?: OrganicMetrics;
    paid?: OrganicMetrics;
  };
};

export type RankedKeywordItem = {
  keyword_data?: {
    keyword?: string;
    keyword_info?: {
      search_volume?: number;
    };
  };
  ranked_serp_element?: {
    serp_item?: {
      rank_group?: number;
      rank_absolute?: number;
    };
  };
};

export type RankedKeywordsResult = {
  target?: string;
  location_code?: number;
  total_count?: number;
  items?: RankedKeywordItem[];
};

export type BacklinksSummaryResult = {
  target?: string;
  backlinks?: number;
  referring_domains?: number;
  referring_main_domains?: number;
  referring_pages?: number;
  rank?: number;
};

export type CompetitorDomainItem = {
  domain?: string;
  avg_position?: number;
  intersections?: number;
  full_domain_metrics?: {
    organic?: OrganicMetrics;
  };
  metrics?: {
    organic?: OrganicMetrics;
  };
};

export type CompetitorsDomainResult = {
  target?: string;
  location_code?: number;
  items?: CompetitorDomainItem[];
};

export type SeoCountryOverview = {
  country: string;
  label: string;
  flag: string;
  location_code: number;
  etv: number;
  keywords_count: number;
  avg_position: number | null;
};

export type SeoTopKeyword = {
  keyword: string;
  position: number;
  volume: number;
  country: string;
};

export type SeoBacklinksSummary = {
  total: number;
  referring_domains: number;
  rank: number;
};

export type SeoCompetitor = {
  domain: string;
  common_keywords: number;
  etv: number;
};

export type SeoKpisResponse = {
  overview: SeoCountryOverview[];
  top_keywords: SeoTopKeyword[];
  backlinks: SeoBacklinksSummary | null;
  competitors: SeoCompetitor[];
  last_updated: string | null;
  configured: boolean;
};

export type SeoSyncSummary = {
  updated: string[];
  errors: Array<{ key: string; error: string }>;
  last_updated: string;
};

function toNumber(raw: unknown): number {
  if (raw == null) return 0;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function locationMeta(locationCode: number) {
  return (
    SEO_PRIORITY_LOCATIONS.find((loc) => loc.code === locationCode) ?? {
      code: locationCode,
      country: String(locationCode),
      label: String(locationCode),
      flag: '🌐',
    }
  );
}

export function isDataForSeoConfigured(): boolean {
  return Boolean(
    process.env.DATAFORSEO_LOGIN?.trim() && process.env.DATAFORSEO_PASSWORD?.trim(),
  );
}

export function getAuthHeader(): string {
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (!login || !password) {
    throw new Error('Missing DATAFORSEO_LOGIN or DATAFORSEO_PASSWORD');
  }
  const encoded = Buffer.from(`${login}:${password}`).toString('base64');
  return `Basic ${encoded}`;
}

function cacheKeyDomainOverview(locationCode: number): string {
  return `domain_overview_${locationCode}`;
}

function cacheKeyRankedKeywords(locationCode: number): string {
  return `ranked_keywords_${locationCode}`;
}

export const SEO_CACHE_KEYS = {
  backlinksSummary: 'backlinks_summary',
  competitors: (locationCode: number) => `competitors_${locationCode}`,
} as const;

async function readSeoCache<T>(key: string): Promise<T | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('seo_cache')
    .select('data, fetched_at')
    .eq('key', key)
    .maybeSingle();

  if (!data?.data || !data.fetched_at) return null;
  if (new Date(data.fetched_at).getTime() + CACHE_TTL_MS <= Date.now()) return null;
  return data.data as T;
}

async function readStaleSeoCache<T>(key: string): Promise<T | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('seo_cache')
    .select('data')
    .eq('key', key)
    .maybeSingle();

  if (!data?.data) return null;
  return data.data as T;
}

export async function writeSeoCache(key: string, payload: unknown): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from('seo_cache').upsert(
    {
      key,
      data: payload as Record<string, unknown>,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: 'key' },
  );
}

export async function readSeoCacheEntry<T>(
  key: string,
  options?: { allowStale?: boolean },
): Promise<T | null> {
  const fresh = await readSeoCache<T>(key);
  if (fresh) return fresh;
  if (options?.allowStale) return readStaleSeoCache<T>(key);
  return null;
}

function extractTaskResult<T>(response: DataForSeoResponse<T>): T {
  const task = response.tasks?.[0];
  if (!task) {
    throw new Error('DataForSEO returned no tasks');
  }
  if ((task.status_code ?? 0) >= 40000) {
    throw new Error(task.status_message ?? `DataForSEO task error ${task.status_code}`);
  }
  const result = task.result?.[0];
  if (!result) {
    throw new Error('DataForSEO returned empty result');
  }
  return result;
}

export async function dataForSeoRequest<T>(
  endpoint: string,
  body: object[],
): Promise<T> {
  if (!isDataForSeoConfigured()) {
    throw new Error('DataForSEO not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${DATAFORSEO_API}/${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      next: { revalidate: 0 },
    });

    if (res.status === 429) {
      const detail = await res.text().catch(() => '');
      throw new Error(`DataForSEO rate limit (429)${detail ? `: ${detail}` : ''}`);
    }

    const json = (await res.json()) as DataForSeoResponse<T>;
    if (!res.ok) {
      throw new Error(json.status_message ?? `DataForSEO HTTP ${res.status}`);
    }
    if ((json.status_code ?? 0) >= 40000) {
      throw new Error(json.status_message ?? `DataForSEO error ${json.status_code}`);
    }

    return extractTaskResult(json);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('DataForSEO request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getDomainOverview(
  domain: string,
  locationCode: number,
): Promise<DomainOverviewResult> {
  return dataForSeoRequest<DomainOverviewResult>(
    'dataforseo_labs/google/domain_rank_overview/live',
    [
      {
        target: domain,
        location_code: locationCode,
        language_code: SEO_LANGUAGE_CODE,
      },
    ],
  );
}

export async function getRankedKeywords(
  domain: string,
  locationCode: number,
  limit: number,
): Promise<RankedKeywordsResult> {
  return dataForSeoRequest<RankedKeywordsResult>(
    'dataforseo_labs/google/ranked_keywords/live',
    [
      {
        target: domain,
        location_code: locationCode,
        language_code: SEO_LANGUAGE_CODE,
        limit,
        filters: [
          ['keyword_data.keyword_info.search_volume', '<>', 0],
          'and',
          [
            ['ranked_serp_element.serp_item.type', '<>', 'paid'],
            'or',
            ['ranked_serp_element.serp_item.is_paid', '=', false],
          ],
        ],
        order_by: ['ranked_serp_element.serp_item.rank_group,asc'],
      },
    ],
  );
}

export async function getBacklinksSummary(domain: string): Promise<BacklinksSummaryResult> {
  return dataForSeoRequest<BacklinksSummaryResult>('backlinks/summary/live', [{ target: domain }]);
}

export async function getCompetitors(
  domain: string,
  locationCode: number,
  limit = 10,
): Promise<CompetitorsDomainResult> {
  return dataForSeoRequest<CompetitorsDomainResult>(
    'dataforseo_labs/google/competitors_domain/live',
    [
      {
        target: domain,
        location_code: locationCode,
        language_code: SEO_LANGUAGE_CODE,
        limit,
        exclude_top_domains: true,
      },
    ],
  );
}

function avgPositionFromKeywords(items: RankedKeywordItem[] | undefined): number | null {
  const positions = (items ?? [])
    .map(
      (item) =>
        item.ranked_serp_element?.serp_item?.rank_group ??
        item.ranked_serp_element?.serp_item?.rank_absolute,
    )
    .filter((value): value is number => typeof value === 'number' && value > 0);

  if (positions.length === 0) return null;
  const sum = positions.reduce((acc, value) => acc + value, 0);
  return Math.round((sum / positions.length) * 10) / 10;
}

function parseOverview(
  locationCode: number,
  overview: DomainOverviewResult | null,
  keywords: RankedKeywordsResult | null,
): SeoCountryOverview {
  const meta = locationMeta(locationCode);
  const organic = overview?.metrics?.organic;
  return {
    country: meta.country,
    label: meta.label,
    flag: meta.flag,
    location_code: locationCode,
    etv: Math.round(toNumber(organic?.etv)),
    keywords_count: toNumber(organic?.count),
    avg_position: avgPositionFromKeywords(keywords?.items),
  };
}

function parseTopKeywords(
  locationCode: number,
  keywords: RankedKeywordsResult | null,
): SeoTopKeyword[] {
  const meta = locationMeta(locationCode);
  return (keywords?.items ?? [])
    .map((item) => ({
      keyword: item.keyword_data?.keyword ?? '',
      position:
        item.ranked_serp_element?.serp_item?.rank_group ??
        item.ranked_serp_element?.serp_item?.rank_absolute ??
        0,
      volume: toNumber(item.keyword_data?.keyword_info?.search_volume),
      country: meta.country,
    }))
    .filter((item) => item.keyword && item.position > 0)
    .sort((a, b) => a.position - b.position);
}

function parseBacklinks(data: BacklinksSummaryResult | null): SeoBacklinksSummary | null {
  if (!data) return null;
  return {
    total: toNumber(data.backlinks),
    referring_domains: toNumber(data.referring_domains),
    rank: toNumber(data.rank),
  };
}

function parseCompetitors(data: CompetitorsDomainResult | null): SeoCompetitor[] {
  return (data?.items ?? [])
    .filter((item) => item.domain && item.domain !== SEO_DOMAIN)
    .map((item) => ({
      domain: item.domain ?? '',
      common_keywords: toNumber(item.intersections),
      etv: Math.round(toNumber(item.metrics?.organic?.etv ?? item.full_domain_metrics?.organic?.etv)),
    }))
    .sort((a, b) => b.common_keywords - a.common_keywords);
}

async function readAllSeoCacheKeys(): Promise<Map<string, unknown>> {
  const supabase = createAdminClient();
  const { data } = await supabase.from('seo_cache').select('key, data, fetched_at');
  const map = new Map<string, unknown>();
  for (const row of data ?? []) {
    map.set(row.key, row.data);
  }
  return map;
}

async function latestSeoCacheTimestamp(): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('seo_cache')
    .select('fetched_at')
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.fetched_at ?? null;
}

export async function getSeoKpis(options?: { allowStale?: boolean }): Promise<SeoKpisResponse> {
  const allowStale = options?.allowStale ?? true;
  const cache = await readAllSeoCacheKeys();
  const lastUpdated = await latestSeoCacheTimestamp();

  const overview: SeoCountryOverview[] = [];
  const topKeywords: SeoTopKeyword[] = [];

  for (const loc of SEO_PRIORITY_LOCATIONS) {
    const overviewData =
      (cache.get(cacheKeyDomainOverview(loc.code)) as DomainOverviewResult | undefined) ?? null;
    const keywordsData =
      (cache.get(cacheKeyRankedKeywords(loc.code)) as RankedKeywordsResult | undefined) ?? null;

    if (!overviewData && !keywordsData) {
      if (!allowStale) continue;
    }

    overview.push(parseOverview(loc.code, overviewData, keywordsData));
    topKeywords.push(...parseTopKeywords(loc.code, keywordsData));
  }

  const backlinksRaw = cache.get(SEO_CACHE_KEYS.backlinksSummary) as BacklinksSummaryResult | undefined;
  const competitorsRaw = cache.get(SEO_CACHE_KEYS.competitors(2484)) as
    | CompetitorsDomainResult
    | undefined;

  return {
    overview,
    top_keywords: topKeywords.sort((a, b) => a.position - b.position).slice(0, 100),
    backlinks: parseBacklinks(backlinksRaw ?? null),
    competitors: parseCompetitors(competitorsRaw ?? null),
    last_updated: lastUpdated,
    configured: isDataForSeoConfigured(),
  };
}

export async function syncSeoMetrics(): Promise<SeoSyncSummary> {
  if (!isDataForSeoConfigured()) {
    throw new Error('DataForSEO not configured');
  }

  const updated: string[] = [];
  const errors: Array<{ key: string; error: string }> = [];
  const domain = SEO_DOMAIN;

  for (const loc of SEO_PRIORITY_LOCATIONS) {
    const overviewKey = cacheKeyDomainOverview(loc.code);
    try {
      const overview = await getDomainOverview(domain, loc.code);
      await writeSeoCache(overviewKey, overview);
      updated.push(overviewKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[dataforseo-api] ${overviewKey} failed`, error);
      errors.push({ key: overviewKey, error: message });
    }

    const keywordsKey = cacheKeyRankedKeywords(loc.code);
    try {
      const keywords = await getRankedKeywords(domain, loc.code, 100);
      await writeSeoCache(keywordsKey, keywords);
      updated.push(keywordsKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[dataforseo-api] ${keywordsKey} failed`, error);
      errors.push({ key: keywordsKey, error: message });
    }
  }

  const backlinksKey = SEO_CACHE_KEYS.backlinksSummary;
  try {
    const backlinks = await getBacklinksSummary(domain);
    await writeSeoCache(backlinksKey, backlinks);
    updated.push(backlinksKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[dataforseo-api] ${backlinksKey} failed`, error);
    errors.push({ key: backlinksKey, error: message });
  }

  const competitorsKey = SEO_CACHE_KEYS.competitors(2484);
  try {
    const competitors = await getCompetitors(domain, 2484, 10);
    await writeSeoCache(competitorsKey, competitors);
    updated.push(competitorsKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[dataforseo-api] ${competitorsKey} failed`, error);
    errors.push({ key: competitorsKey, error: message });
  }

  return {
    updated,
    errors,
    last_updated: new Date().toISOString(),
  };
}
