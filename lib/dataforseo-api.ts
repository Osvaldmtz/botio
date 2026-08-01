import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { getPageSpeedMetrics } from '@/lib/pagespeed-api';
import {
  getSemrushDomainOverviewCached,
  isSemrushConfigured,
  resolveAuthorityScore,
  syncSemrushDomainOverview,
  type SeoAuthorityScore,
} from '@/lib/semrush-api';

const DATAFORSEO_API = 'https://api.dataforseo.com/v3';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const ON_PAGE_TASK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 60_000;

export const SEO_DOMAIN = 'kalyo.io';
export const SEO_LANGUAGE_CODE = 'es';
/** LLM Mentions API: ChatGPT data is US + English only per DataForSEO docs */
export const SEO_LLM_LOCATION_CODE = 2840;
export const SEO_LLM_LANGUAGE_CODE = 'en';

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
  items?: Array<{
    metrics?: {
      organic?: OrganicMetrics;
      paid?: OrganicMetrics;
    };
  }>;
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
      url?: string;
      etv?: number;
      rank_changes?: {
        previous_rank_absolute?: number | null;
        is_up?: boolean;
        is_down?: boolean;
        is_new?: boolean;
      };
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
  referring_pages_nofollow?: number;
  rank?: number;
  referring_links_types?: Record<string, number>;
  referring_links_attributes?: Record<string, number>;
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

export type LlmMentionItem = {
  llm_type?: string;
  mentions_count?: number;
  pages_cited_count?: number;
};

export type LlmMentionsResult = {
  items?: LlmMentionItem[];
  aggregated_metrics?: {
    platform?: Array<{ key?: string; mentions?: number }>;
    total?: { mentions?: number };
  };
};

export type BacklinkDetailItem = {
  url_from?: string;
  url_to?: string;
  anchor?: string | null;
  rank?: number;
  dofollow?: boolean;
};

export type BacklinksDetailResult = {
  items?: BacklinkDetailItem[];
  total_count?: number;
};

export type AnchorTextItem = {
  anchor?: string | null;
  backlinks?: number;
  referring_domains?: number;
};

export type AnchorTextsResult = {
  items?: AnchorTextItem[];
};

export type ReferringDomainItem = {
  domain?: string;
  rank?: number;
  backlinks?: number;
  referring_pages?: number;
  referring_pages_nofollow?: number;
};

export type ReferringDomainsResult = {
  items?: ReferringDomainItem[];
};

export type SeoAiVisibilityModel =
  | 'ChatGPT'
  | 'Google AI Overview'
  | 'Modo IA'
  | 'Gemini';

export type SeoAiVisibility = {
  total_mentions: number;
  pages_cited: number;
  by_model: Array<{
    model: SeoAiVisibilityModel;
    mentions: number;
    pages_cited: number;
  }>;
};

export type SeoBacklinksDetail = {
  follow_count: number;
  nofollow_count: number;
  text_pct: number;
  image_pct: number;
  top_backlinks: Array<{
    url_from: string;
    url_to: string;
    anchor: string;
    rank: number;
    dofollow: boolean;
  }>;
  top_anchors: Array<{
    anchor: string;
    backlinks: number;
    referring_domains: number;
  }>;
  top_referring_domains: Array<{
    domain: string;
    rank: number;
    backlinks: number;
    dofollow: number;
  }>;
};

export type SeoCompetitor = {
  domain: string;
  common_keywords: number;
  etv: number;
};

export type SeoSiteAudit = {
  status: 'pending' | 'in_progress' | 'ready';
  site_health: number;
  pages_crawled: number;
  pages_ok: number;
  pages_with_issues: number;
  pages_redirected: number;
  pages_blocked: number;
  broken_links: number;
  missing_titles: number;
  missing_descriptions: number;
  missing_h1: number;
  duplicate_content: number;
  low_word_count: number;
  js_css_not_minified: number;
  single_internal_link_pages: number;
  unoptimized_content: number;
  crawlability_score: number;
  https_score: number;
  international_seo_score: number;
  internal_links_score: number;
  markup_score: number;
  performance_score: number;
};

export type SeoPageSpeedSummary = {
  performance_mobile: number;
  performance_desktop: number;
  lcp: number;
  cls: number;
  tbt: number;
  speed_index: number;
};

export type SeoPositionTrackingKeyword = {
  keyword: string;
  position: number;
  volume: number;
  visibility_pct: number;
  url: string;
  etv: number;
  position_change: number | null;
};

export type SeoPositionTrackingPage = {
  url: string;
  keywords_count: number;
  avg_position: number;
  estimated_traffic: number;
};

export type SeoPositionTrackingCompetitor = {
  domain: string;
  common_keywords: number;
  etv: number;
  visibility_approx: number;
};

export type SeoPositionTracking = {
  visibility: number;
  avg_position: number;
  estimated_traffic: number;
  keywords_tracked: number;
  keywords_top3: number;
  keywords_top10: number;
  keywords_top20: number;
  keywords_top100: number;
  keywords_improved: number | null;
  keywords_declined: number | null;
  top_keywords: SeoPositionTrackingKeyword[];
  pages: SeoPositionTrackingPage[];
  competitors_visibility: SeoPositionTrackingCompetitor[];
};

export type { SeoAuthorityScore } from '@/lib/semrush-api';

export type SeoKpisResponse = {
  overview: SeoCountryOverview[];
  top_keywords: SeoTopKeyword[];
  position_tracking: SeoPositionTracking;
  ai_visibility: SeoAiVisibility | null;
  backlinks: SeoBacklinksSummary | null;
  backlinks_detail: SeoBacklinksDetail | null;
  authority_score: SeoAuthorityScore;
  competitors: SeoCompetitor[];
  site_audit: SeoSiteAudit | null;
  pagespeed: SeoPageSpeedSummary | null;
  last_updated: string | null;
  configured: boolean;
};

export type SeoSyncSummary = {
  updated: string[];
  errors: Array<{
    key: string;
    error: string;
    httpStatus?: number;
    responseBody?: string;
  }>;
  last_updated: string;
};

export class DataForSeoHttpError extends Error {
  readonly httpStatus: number;
  readonly responseBody: string;
  readonly endpoint: string;

  constructor(message: string, httpStatus: number, responseBody: string, endpoint: string) {
    super(message);
    this.name = 'DataForSeoHttpError';
    this.httpStatus = httpStatus;
    this.responseBody = responseBody;
    this.endpoint = endpoint;
  }
}

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
  backlinksDetail: 'backlinks_detail',
  anchorTexts: 'anchor_texts',
  referringDomains: 'referring_domains',
  llmMentions: 'llm_mentions',
  competitors: (locationCode: number) => `competitors_${locationCode}`,
  onPageTaskId: 'on_page_task_id',
  onPageSummary: 'on_page_summary',
  onPagePages: 'on_page_pages',
  pageSpeedSummary: 'pagespeed_summary',
} as const;

type OnPageChecks = Record<string, number | boolean | undefined>;

export type OnPageSummaryRaw = {
  crawl_progress?: string;
  crawl_status?: {
    pages_crawled?: number;
    pages_in_queue?: number;
    max_crawl_pages?: number;
  };
  domain_info?: {
    total_pages?: number;
    checks?: Record<string, boolean | undefined>;
    ssl_info?: { valid_certificate?: boolean };
  };
  page_metrics?: {
    onpage_score?: number;
    broken_links?: number;
    duplicate_content?: number;
    non_indexable?: number;
    links_internal?: number;
    checks?: OnPageChecks;
  };
};

export type OnPagePageItem = {
  url?: string;
  status_code?: number;
  onpage_score?: number;
  meta?: {
    title?: string;
    description?: string;
    htags?: { h1?: string[] };
    hreflang?: unknown[];
  };
  checks?: OnPageChecks;
};

export type OnPagePagesRaw = {
  items?: OnPagePageItem[];
  total_count?: number;
};

type OnPageTaskCache = {
  task_id: string;
  created_at: string;
};

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

    const responseBody = await res.text().catch(() => '');

    if (res.status === 429) {
      console.error('[dataforseo-api] rate limit', {
        endpoint,
        httpStatus: res.status,
        responseBody,
      });
      throw new DataForSeoHttpError(
        `DataForSEO rate limit (429)`,
        res.status,
        responseBody,
        endpoint,
      );
    }

    let json: DataForSeoResponse<T>;
    try {
      json = JSON.parse(responseBody) as DataForSeoResponse<T>;
    } catch {
      console.error('[dataforseo-api] invalid JSON response', {
        endpoint,
        httpStatus: res.status,
        responseBody,
      });
      throw new DataForSeoHttpError(
        `DataForSEO invalid JSON (HTTP ${res.status})`,
        res.status,
        responseBody,
        endpoint,
      );
    }

    if (!res.ok) {
      console.error('[dataforseo-api] HTTP error', {
        endpoint,
        httpStatus: res.status,
        responseBody,
      });
      throw new DataForSeoHttpError(
        json.status_message ?? `DataForSEO HTTP ${res.status}`,
        res.status,
        responseBody,
        endpoint,
      );
    }

    if ((json.status_code ?? 0) >= 40000) {
      console.error('[dataforseo-api] API error', {
        endpoint,
        httpStatus: res.status,
        statusCode: json.status_code,
        statusMessage: json.status_message,
        responseBody,
      });
      throw new DataForSeoHttpError(
        json.status_message ?? `DataForSEO error ${json.status_code}`,
        res.status,
        responseBody,
        endpoint,
      );
    }

    return extractTaskResult(json);
  } catch (error) {
    if (error instanceof DataForSeoHttpError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('DataForSEO request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function readSeoCacheMeta<T>(key: string): Promise<{ data: T; fetched_at: string } | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('seo_cache')
    .select('data, fetched_at')
    .eq('key', key)
    .maybeSingle();
  if (!data?.data || !data.fetched_at) return null;
  return { data: data.data as T, fetched_at: data.fetched_at };
}

async function dataForSeoGet<T>(endpoint: string): Promise<T> {
  if (!isDataForSeoConfigured()) {
    throw new Error('DataForSEO not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${DATAFORSEO_API}/${endpoint}`, {
      method: 'GET',
      headers: {
        Authorization: getAuthHeader(),
        Accept: 'application/json',
      },
      signal: controller.signal,
      cache: 'no-store',
    });

    const responseBody = await res.text().catch(() => '');

    if (res.status === 429) {
      throw new DataForSeoHttpError('DataForSEO rate limit (429)', res.status, responseBody, endpoint);
    }

    let json: DataForSeoResponse<T>;
    try {
      json = JSON.parse(responseBody) as DataForSeoResponse<T>;
    } catch {
      throw new DataForSeoHttpError(
        `DataForSEO invalid JSON (HTTP ${res.status})`,
        res.status,
        responseBody,
        endpoint,
      );
    }

    if (!res.ok) {
      throw new DataForSeoHttpError(
        json.status_message ?? `DataForSEO HTTP ${res.status}`,
        res.status,
        responseBody,
        endpoint,
      );
    }

    if ((json.status_code ?? 0) >= 40000) {
      throw new DataForSeoHttpError(
        json.status_message ?? `DataForSEO error ${json.status_code}`,
        res.status,
        responseBody,
        endpoint,
      );
    }

    return extractTaskResult(json);
  } catch (error) {
    if (error instanceof DataForSeoHttpError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('DataForSEO request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function dataForSeoPostEnvelope(endpoint: string, body: object[]): Promise<DataForSeoResponse<unknown>> {
  if (!isDataForSeoConfigured()) {
    throw new Error('DataForSEO not configured');
  }

  const res = await fetch(`${DATAFORSEO_API}/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const responseBody = await res.text().catch(() => '');
  const json = JSON.parse(responseBody) as DataForSeoResponse<unknown>;

  if (!res.ok || (json.status_code ?? 0) >= 40000) {
    throw new DataForSeoHttpError(
      json.status_message ?? `DataForSEO HTTP ${res.status}`,
      res.status,
      responseBody,
      endpoint,
    );
  }

  return json;
}

export async function createOnPageTask(domain: string): Promise<string> {
  const envelope = await dataForSeoPostEnvelope('on_page/task_post', [
    {
      target: domain,
      max_crawl_pages: 100,
      load_resources: true,
      enable_javascript: false,
      custom_robots_txt_body: null,
    },
  ]);

  const taskId = envelope.tasks?.[0]?.id;
  if (!taskId) {
    throw new Error('DataForSEO On-Page task_post returned no task id');
  }

  return taskId;
}

export async function getOnPageSummary(taskId: string): Promise<OnPageSummaryRaw> {
  return dataForSeoGet<OnPageSummaryRaw>(`on_page/summary/${taskId}`);
}

export async function getOnPagePages(taskId: string): Promise<OnPagePagesRaw> {
  return dataForSeoGet<OnPagePagesRaw>(`on_page/pages/${taskId}`);
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

export async function getLlmMentions(domain: string): Promise<LlmMentionsResult> {
  const metricsRaw = await dataForSeoRequest<{
    aggregated_metrics?: {
      platform?: Array<{ key?: string; mentions?: number }>;
      total?: { mentions?: number };
    };
  }>('ai_optimization/llm_mentions/target_metrics/live', [
    {
      target: [{ domain, search_filter: 'include' }],
      location_code: SEO_LLM_LOCATION_CODE,
      language_code: SEO_LLM_LANGUAGE_CODE,
      internal_list_limit: 10,
    },
  ]);

  const platformToLlmType: Record<string, string> = {
    chat_gpt: 'chatgpt',
    google: 'google_ai_overview',
    gemini: 'gemini',
    perplexity: 'perplexity',
  };

  const items: LlmMentionItem[] = (metricsRaw.aggregated_metrics?.platform ?? []).map((row) => ({
    llm_type: platformToLlmType[row.key ?? ''] ?? row.key,
    mentions_count: toNumber(row.mentions),
    pages_cited_count: 0,
  }));

  if (items.length > 0) {
    try {
      const pages = await dataForSeoRequest<{ items?: Array<{ page?: string }> }>(
        'ai_optimization/llm_mentions/top_mentioned_pages/live',
        [
          {
            target: [{ domain, search_filter: 'include' }],
            location_code: SEO_LLM_LOCATION_CODE,
            language_code: SEO_LLM_LANGUAGE_CODE,
            limit: 10,
            links_scope: 'sources',
          },
        ],
      );
      const pagesCited = (pages.items ?? []).length;
      if (pagesCited > 0) {
        const perModel = Math.max(1, Math.ceil(pagesCited / items.length));
        for (const item of items) {
          item.pages_cited_count = perModel;
        }
      }
    } catch {
      // pages cited enrichment is optional
    }
  }

  return { items, aggregated_metrics: metricsRaw.aggregated_metrics };
}

export async function getBacklinksDetail(domain: string): Promise<BacklinksDetailResult> {
  return dataForSeoRequest<BacklinksDetailResult>('backlinks/backlinks/live', [
    {
      target: domain,
      limit: 10,
      order_by: ['rank,desc'],
    },
  ]);
}

export async function getAnchorTexts(domain: string): Promise<AnchorTextsResult> {
  return dataForSeoRequest<AnchorTextsResult>('backlinks/anchors/live', [
    {
      target: domain,
      limit: 10,
      order_by: ['backlinks,desc'],
    },
  ]);
}

export async function getReferringDomains(domain: string): Promise<ReferringDomainsResult> {
  return dataForSeoRequest<ReferringDomainsResult>('backlinks/referring_domains/live', [
    {
      target: domain,
      limit: 10,
      order_by: ['rank,desc'],
    },
  ]);
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

function organicMetricsFromOverview(overview: DomainOverviewResult | null): OrganicMetrics | undefined {
  return overview?.metrics?.organic ?? overview?.items?.[0]?.metrics?.organic;
}

function keywordVisibilityPct(volume: number, position: number): number {
  if (position <= 0) return 0;
  return Math.min(100, Math.round((volume / Math.max(position, 1)) * 0.05));
}

type ParsedRankedKeyword = {
  keyword: string;
  position: number;
  volume: number;
  url: string;
  etv: number;
  visibility_pct: number;
  position_change: number | null;
};

function parseRankedKeywordItems(items: RankedKeywordItem[] | undefined): ParsedRankedKeyword[] {
  return (items ?? [])
    .map((item) => {
      const serp = item.ranked_serp_element?.serp_item;
      const position = serp?.rank_group ?? serp?.rank_absolute ?? 0;
      const volume = toNumber(item.keyword_data?.keyword_info?.search_volume);
      const keyword = item.keyword_data?.keyword ?? '';
      const url = serp?.url ?? '';
      const etv = toNumber(serp?.etv);
      const previous = serp?.rank_changes?.previous_rank_absolute;
      const position_change =
        typeof previous === 'number' && previous > 0 && position > 0 ? previous - position : null;

      return {
        keyword,
        position,
        volume,
        url,
        etv,
        visibility_pct: keywordVisibilityPct(volume, position),
        position_change,
      };
    })
    .filter((item) => item.keyword && item.position > 0);
}

function computePositionChanges(
  current: ParsedRankedKeyword[],
  previous: ParsedRankedKeyword[] | null,
): { improved: number | null; declined: number | null } {
  if (!previous?.length) return { improved: null, declined: null };

  const prevMap = new Map(previous.map((row) => [row.keyword, row.position]));
  let improved = 0;
  let declined = 0;

  for (const row of current) {
    const prevPosition = prevMap.get(row.keyword);
    if (prevPosition == null) continue;
    if (row.position < prevPosition) improved += 1;
    else if (row.position > prevPosition) declined += 1;
  }

  return { improved, declined };
}

function groupKeywordsByPage(keywords: ParsedRankedKeyword[]): SeoPositionTrackingPage[] {
  const byUrl = new Map<string, ParsedRankedKeyword[]>();

  for (const row of keywords) {
    const url = row.url || '(sin URL)';
    const bucket = byUrl.get(url) ?? [];
    bucket.push(row);
    byUrl.set(url, bucket);
  }

  return Array.from(byUrl.entries())
    .map(([url, rows]) => ({
      url,
      keywords_count: rows.length,
      avg_position:
        Math.round((rows.reduce((sum, row) => sum + row.position, 0) / rows.length) * 10) / 10,
      estimated_traffic: Math.round(rows.reduce((sum, row) => sum + row.etv, 0) * 100) / 100,
    }))
    .sort((a, b) => b.estimated_traffic - a.estimated_traffic || a.avg_position - b.avg_position);
}

function buildPositionTracking(
  keywords: RankedKeywordsResult | null,
  competitors: CompetitorsDomainResult | null,
  previousKeywords: RankedKeywordsResult | null,
): SeoPositionTracking {
  const parsed = parseRankedKeywordItems(keywords?.items);
  const total = parsed.length;

  const withTrafficInTop100 = parsed.filter((row) => row.position <= 100 && row.etv > 0).length;
  const visibility = total > 0 ? Math.round((withTrafficInTop100 / total) * 1000) / 10 : 0;

  const avg_position =
    total > 0
      ? Math.round((parsed.reduce((sum, row) => sum + row.position, 0) / total) * 10) / 10
      : 0;

  const estimated_traffic = Math.round(parsed.reduce((sum, row) => sum + row.etv, 0) * 100) / 100;

  const previousParsed = previousKeywords
    ? parseRankedKeywordItems(previousKeywords.items)
    : null;
  const { improved, declined } = computePositionChanges(parsed, previousParsed);

  const top_keywords = [...parsed]
    .sort((a, b) => b.visibility_pct - a.visibility_pct || a.position - b.position)
    .slice(0, 10);

  const competitorsParsed = parseCompetitors(competitors);
  const competitors_visibility = competitorsParsed.map((row) => ({
    ...row,
    visibility_approx:
      estimated_traffic > 0 ? Math.min(100, Math.round((row.etv / estimated_traffic) * 100)) : 0,
  }));

  return {
    visibility,
    avg_position,
    estimated_traffic,
    keywords_tracked: total,
    keywords_top3: parsed.filter((row) => row.position <= 3).length,
    keywords_top10: parsed.filter((row) => row.position <= 10).length,
    keywords_top20: parsed.filter((row) => row.position <= 20).length,
    keywords_top100: parsed.filter((row) => row.position <= 100).length,
    keywords_improved: improved,
    keywords_declined: declined,
    top_keywords,
    pages: groupKeywordsByPage(parsed),
    competitors_visibility,
  };
}

async function readPreviousRankedKeywordsSnapshot(
  locationCode: number,
): Promise<RankedKeywordsResult | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('seo_history')
      .select('data')
      .eq('key', cacheKeyRankedKeywords(locationCode))
      .order('snapshot_at', { ascending: false })
      .range(1, 1)
      .maybeSingle();

    if (error) return null;
    return (data?.data as RankedKeywordsResult) ?? null;
  } catch {
    return null;
  }
}

function parseOverview(
  locationCode: number,
  overview: DomainOverviewResult | null,
  keywords: RankedKeywordsResult | null,
): SeoCountryOverview {
  const meta = locationMeta(locationCode);
  const organic = organicMetricsFromOverview(overview);
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

const AI_MODEL_ORDER: SeoAiVisibilityModel[] = [
  'ChatGPT',
  'Google AI Overview',
  'Modo IA',
  'Gemini',
];

const LLM_TYPE_TO_MODEL: Record<string, SeoAiVisibilityModel> = {
  chatgpt: 'ChatGPT',
  chat_gpt: 'ChatGPT',
  google_ai_overview: 'Google AI Overview',
  google: 'Google AI Overview',
  perplexity: 'Modo IA',
  ai_mode: 'Modo IA',
  gemini: 'Gemini',
};

function parseAiVisibility(data: LlmMentionsResult | null): SeoAiVisibility | null {
  if (!data) return null;

  const byModelMap = new Map<SeoAiVisibilityModel, { mentions: number; pages_cited: number }>();

  for (const item of data.items ?? []) {
    const llmType = (item.llm_type ?? '').toLowerCase();
    const model = LLM_TYPE_TO_MODEL[llmType];
    if (!model) continue;
    const existing = byModelMap.get(model) ?? { mentions: 0, pages_cited: 0 };
    byModelMap.set(model, {
      mentions: existing.mentions + toNumber(item.mentions_count),
      pages_cited: existing.pages_cited + toNumber(item.pages_cited_count),
    });
  }

  if (byModelMap.size === 0 && data.aggregated_metrics?.platform) {
    for (const row of data.aggregated_metrics.platform) {
      const llmType = (row.key ?? '').toLowerCase();
      const model = LLM_TYPE_TO_MODEL[llmType];
      if (!model) continue;
      byModelMap.set(model, {
        mentions: toNumber(row.mentions),
        pages_cited: 0,
      });
    }
  }

  const by_model = AI_MODEL_ORDER.map((model) => ({
    model,
    mentions: byModelMap.get(model)?.mentions ?? 0,
    pages_cited: byModelMap.get(model)?.pages_cited ?? 0,
  }));

  const total_mentions =
    toNumber(data.aggregated_metrics?.total?.mentions) ||
    by_model.reduce((sum, row) => sum + row.mentions, 0);
  const pages_cited = by_model.reduce((sum, row) => sum + row.pages_cited, 0);

  return { total_mentions, pages_cited, by_model };
}

function parseBacklinksDetail(
  summary: BacklinksSummaryResult | null,
  backlinks: BacklinksDetailResult | null,
  anchors: AnchorTextsResult | null,
  referringDomains: ReferringDomainsResult | null,
): SeoBacklinksDetail | null {
  if (!backlinks && !anchors && !referringDomains && !summary) return null;

  const linkTypes = summary?.referring_links_types as Record<string, number> | undefined;
  const linkAttrs = summary?.referring_links_attributes as Record<string, number> | undefined;
  const totalLinks = toNumber(summary?.backlinks);
  const anchorLinks = toNumber(linkTypes?.anchor);
  const imageLinks = toNumber(linkTypes?.image);
  const typeTotal = anchorLinks + imageLinks || totalLinks;

  const nofollowCount =
    toNumber(linkAttrs?.nofollow) ||
    toNumber(summary?.referring_pages_nofollow) ||
    (backlinks?.items ?? []).filter((item) => item.dofollow === false).length;
  const followCount = Math.max(0, totalLinks - nofollowCount);

  return {
    follow_count: followCount,
    nofollow_count: nofollowCount,
    text_pct: typeTotal > 0 ? Math.round((anchorLinks / typeTotal) * 100) : 0,
    image_pct: typeTotal > 0 ? Math.round((imageLinks / typeTotal) * 100) : 0,
    top_backlinks: (backlinks?.items ?? []).slice(0, 10).map((item) => ({
      url_from: item.url_from ?? '',
      url_to: item.url_to ?? '',
      anchor: item.anchor ?? '—',
      rank: toNumber(item.rank),
      dofollow: item.dofollow !== false,
    })),
    top_anchors: (anchors?.items ?? []).slice(0, 10).map((item) => ({
      anchor: item.anchor ?? '—',
      backlinks: toNumber(item.backlinks),
      referring_domains: toNumber(item.referring_domains),
    })),
    top_referring_domains: (referringDomains?.items ?? []).slice(0, 10).map((item) => ({
      domain: item.domain ?? '',
      rank: toNumber(item.rank),
      backlinks: toNumber(item.backlinks),
      dofollow: Math.max(
        0,
        toNumber(item.referring_pages) - toNumber(item.referring_pages_nofollow),
      ),
    })),
  };
}

function recordSyncError(
  errors: SeoSyncSummary['errors'],
  key: string,
  error: unknown,
): void {
  if (error instanceof DataForSeoHttpError) {
    console.error(`[dataforseo-api] ${key} failed`, {
      key,
      endpoint: error.endpoint,
      httpStatus: error.httpStatus,
      responseBody: error.responseBody,
      message: error.message,
    });
    errors.push({
      key,
      error: error.message,
      httpStatus: error.httpStatus,
      responseBody: error.responseBody,
    });
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  console.error(`[dataforseo-api] ${key} failed`, { key, message, error });
  errors.push({ key, error: message });
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

function checkCount(checks: OnPageChecks | undefined, keys: string[]): number {
  return keys.reduce((sum, key) => sum + toNumber(checks?.[key]), 0);
}

function domainCheckScore(checks: Record<string, boolean | undefined> | undefined): number {
  if (!checks) return 0;
  const values = Object.values(checks).filter((value) => typeof value === 'boolean');
  if (values.length === 0) return 0;
  const passed = values.filter(Boolean).length;
  return Math.round((passed / values.length) * 100);
}

function countHreflangPages(pages: OnPagePagesRaw | null): number {
  return (pages?.items ?? []).filter((page) => (page.meta?.hreflang?.length ?? 0) > 0).length;
}

function parseSiteAudit(
  summary: OnPageSummaryRaw | null,
  pages: OnPagePagesRaw | null,
  taskMeta: OnPageTaskCache | null,
): SeoSiteAudit | null {
  if (!summary && !taskMeta) return null;

  if (!summary && taskMeta) {
    return {
      status: 'pending',
      site_health: 0,
      pages_crawled: 0,
      pages_ok: 0,
      pages_with_issues: 0,
      pages_redirected: 0,
      pages_blocked: 0,
      broken_links: 0,
      missing_titles: 0,
      missing_descriptions: 0,
      missing_h1: 0,
      duplicate_content: 0,
      low_word_count: 0,
      js_css_not_minified: 0,
      single_internal_link_pages: 0,
      unoptimized_content: 0,
      crawlability_score: 0,
      https_score: 100,
      international_seo_score: 0,
      internal_links_score: 0,
      markup_score: 0,
      performance_score: 0,
    };
  }

  const checks = summary?.page_metrics?.checks ?? {};
  const pagesCrawled =
    toNumber(summary?.crawl_status?.pages_crawled) ||
    toNumber(summary?.domain_info?.total_pages);
  const brokenPages = checkCount(checks, ['is_broken', 'is_4xx_code', 'is_5xx_code']);
  const redirected = checkCount(checks, ['is_redirect']);
  const blocked = toNumber(summary?.page_metrics?.non_indexable);
  const pagesWithIssues =
    checkCount(checks, [
      'no_title',
      'no_description',
      'no_h1_tag',
      'duplicate_content',
      'low_character_count',
      'has_render_blocking_resources',
      'is_orphan_page',
      'low_readability_rate',
      'lorem_ipsum',
    ]) + toNumber(summary?.page_metrics?.duplicate_content);
  const pagesOk = Math.max(0, pagesCrawled - brokenPages - redirected - blocked);

  const domainChecks = summary?.domain_info?.checks;
  const httpsScore =
    domainChecks?.ssl && domainChecks?.test_https_redirect
      ? 100
      : domainChecks?.ssl
        ? 75
        : 0;

  const hreflangPages = countHreflangPages(pages);
  const internationalScore =
    pagesCrawled > 0 ? Math.min(100, Math.round((hreflangPages / pagesCrawled) * 100) + 40) : 0;

  const orphanPages = checkCount(checks, ['is_orphan_page']);
  const internalLinksScore =
    pagesCrawled > 0 ? Math.max(0, Math.round(100 - (orphanPages / pagesCrawled) * 100)) : 0;

  const markupScore = Math.round(
    (checkCount(checks, ['has_html_doctype', 'canonical']) / Math.max(pagesCrawled, 1)) * 100,
  );

  const crawlability = domainCheckScore(domainChecks);

  return {
    status: summary?.crawl_progress === 'finished' ? 'ready' : 'in_progress',
    site_health: Math.round(toNumber(summary?.page_metrics?.onpage_score)),
    pages_crawled: pagesCrawled,
    pages_ok: pagesOk,
    pages_with_issues: pagesWithIssues,
    pages_redirected: redirected,
    pages_blocked: blocked,
    broken_links: toNumber(summary?.page_metrics?.broken_links),
    missing_titles: checkCount(checks, ['no_title']),
    missing_descriptions: checkCount(checks, ['no_description']),
    missing_h1: checkCount(checks, ['no_h1_tag']),
    duplicate_content: toNumber(summary?.page_metrics?.duplicate_content),
    low_word_count: checkCount(checks, ['low_character_count']),
    js_css_not_minified: checkCount(checks, ['has_render_blocking_resources', 'no_content_encoding']),
    single_internal_link_pages: orphanPages,
    unoptimized_content: checkCount(checks, ['low_readability_rate', 'lorem_ipsum']),
    crawlability_score: crawlability,
    https_score: httpsScore,
    international_seo_score: Math.min(100, internationalScore),
    internal_links_score: internalLinksScore,
    markup_score: Math.min(100, markupScore),
    performance_score: Math.max(
      0,
      100 - checkCount(checks, ['high_loading_time', 'high_waiting_time', 'has_render_blocking_resources']) * 5,
    ),
  };
}

function parsePageSpeedSummary(raw: SeoPageSpeedSummary | null | undefined): SeoPageSpeedSummary | null {
  if (!raw) return null;
  return {
    performance_mobile: toNumber(raw.performance_mobile),
    performance_desktop: toNumber(raw.performance_desktop),
    lcp: toNumber(raw.lcp),
    cls: toNumber(raw.cls),
    tbt: toNumber(raw.tbt),
    speed_index: toNumber(raw.speed_index),
  };
}

async function syncOnPageAudit(
  domain: string,
  updated: string[],
  errors: SeoSyncSummary['errors'],
): Promise<void> {
  const taskMeta = await readSeoCacheMeta<OnPageTaskCache>(SEO_CACHE_KEYS.onPageTaskId);
  const taskAgeMs = taskMeta?.fetched_at
    ? Date.now() - new Date(taskMeta.fetched_at).getTime()
    : Number.POSITIVE_INFINITY;
  const taskExpired = !taskMeta || taskAgeMs > ON_PAGE_TASK_TTL_MS;

  if (!taskMeta?.data.task_id || taskExpired) {
    try {
      const taskId = await createOnPageTask(domain);
      await writeSeoCache(SEO_CACHE_KEYS.onPageTaskId, {
        task_id: taskId,
        created_at: new Date().toISOString(),
      });
      updated.push(SEO_CACHE_KEYS.onPageTaskId);
    } catch (error) {
      recordSyncError(errors, SEO_CACHE_KEYS.onPageTaskId, error);
    }
    return;
  }

  const taskId = taskMeta.data.task_id;

  try {
    const summary = await getOnPageSummary(taskId);
    await writeSeoCache(SEO_CACHE_KEYS.onPageSummary, summary);
    updated.push(SEO_CACHE_KEYS.onPageSummary);

    if (summary.crawl_progress === 'finished') {
      const pages = await getOnPagePages(taskId);
      await writeSeoCache(SEO_CACHE_KEYS.onPagePages, pages);
      updated.push(SEO_CACHE_KEYS.onPagePages);
    }
  } catch (error) {
    recordSyncError(errors, SEO_CACHE_KEYS.onPageSummary, error);
  }
}

async function syncPageSpeedSummary(
  updated: string[],
  errors: SeoSyncSummary['errors'],
): Promise<void> {
  try {
    const metrics = await getPageSpeedMetrics({ skipCache: true });
    const summary: SeoPageSpeedSummary = {
      performance_mobile: metrics.landing_mobile.performance,
      performance_desktop: metrics.landing_desktop.performance,
      lcp: metrics.landing_mobile.lcp,
      cls: metrics.landing_mobile.cls,
      tbt: metrics.landing_mobile.tbt,
      speed_index: metrics.landing_mobile.speed_index,
    };
    await writeSeoCache(SEO_CACHE_KEYS.pageSpeedSummary, summary);
    updated.push(SEO_CACHE_KEYS.pageSpeedSummary);
  } catch (error) {
    recordSyncError(errors, SEO_CACHE_KEYS.pageSpeedSummary, error);
  }
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
  const llmMentionsRaw = cache.get(SEO_CACHE_KEYS.llmMentions) as LlmMentionsResult | undefined;
  const backlinksDetailRaw = cache.get(SEO_CACHE_KEYS.backlinksDetail) as
    | BacklinksDetailResult
    | undefined;
  const anchorTextsRaw = cache.get(SEO_CACHE_KEYS.anchorTexts) as AnchorTextsResult | undefined;
  const referringDomainsRaw = cache.get(SEO_CACHE_KEYS.referringDomains) as
    | ReferringDomainsResult
    | undefined;
  const competitorsRaw = cache.get(SEO_CACHE_KEYS.competitors(2484)) as
    | CompetitorsDomainResult
    | undefined;
  const mxKeywordsRaw = cache.get(cacheKeyRankedKeywords(2484)) as
    | RankedKeywordsResult
    | undefined;
  const previousMxKeywords = await readPreviousRankedKeywordsSnapshot(2484);

  const onPageSummary = cache.get(SEO_CACHE_KEYS.onPageSummary) as OnPageSummaryRaw | undefined;
  const onPagePages = cache.get(SEO_CACHE_KEYS.onPagePages) as OnPagePagesRaw | undefined;
  const onPageTask = cache.get(SEO_CACHE_KEYS.onPageTaskId) as OnPageTaskCache | undefined;
  const pageSpeedRaw = cache.get(SEO_CACHE_KEYS.pageSpeedSummary) as SeoPageSpeedSummary | undefined;

  const backlinks = parseBacklinks(backlinksRaw ?? null);
  const semrushOverview = await getSemrushDomainOverviewCached(SEO_DOMAIN);

  return {
    overview,
    top_keywords: topKeywords.sort((a, b) => a.position - b.position).slice(0, 100),
    position_tracking: buildPositionTracking(
      mxKeywordsRaw ?? null,
      competitorsRaw ?? null,
      previousMxKeywords,
    ),
    ai_visibility: parseAiVisibility(llmMentionsRaw ?? null),
    backlinks,
    backlinks_detail: parseBacklinksDetail(
      backlinksRaw ?? null,
      backlinksDetailRaw ?? null,
      anchorTextsRaw ?? null,
      referringDomainsRaw ?? null,
    ),
    authority_score: resolveAuthorityScore(semrushOverview, backlinks?.rank ?? 0),
    competitors: parseCompetitors(competitorsRaw ?? null),
    site_audit: parseSiteAudit(onPageSummary ?? null, onPagePages ?? null, onPageTask ?? null),
    pagespeed: parsePageSpeedSummary(pageSpeedRaw ?? null),
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
      recordSyncError(errors, overviewKey, error);
    }

    const keywordsKey = cacheKeyRankedKeywords(loc.code);
    try {
      const keywords = await getRankedKeywords(domain, loc.code, 100);
      await writeSeoCache(keywordsKey, keywords);
      updated.push(keywordsKey);
    } catch (error) {
      recordSyncError(errors, keywordsKey, error);
    }
  }

  const backlinksKey = SEO_CACHE_KEYS.backlinksSummary;
  try {
    const backlinks = await getBacklinksSummary(domain);
    await writeSeoCache(backlinksKey, backlinks);
    updated.push(backlinksKey);
  } catch (error) {
    recordSyncError(errors, backlinksKey, error);
  }

  const llmMentionsKey = SEO_CACHE_KEYS.llmMentions;
  try {
    const llmMentions = await getLlmMentions(domain);
    await writeSeoCache(llmMentionsKey, llmMentions);
    updated.push(llmMentionsKey);
  } catch (error) {
    recordSyncError(errors, llmMentionsKey, error);
  }

  const backlinksDetailKey = SEO_CACHE_KEYS.backlinksDetail;
  try {
    const backlinksDetail = await getBacklinksDetail(domain);
    await writeSeoCache(backlinksDetailKey, backlinksDetail);
    updated.push(backlinksDetailKey);
  } catch (error) {
    recordSyncError(errors, backlinksDetailKey, error);
  }

  const anchorTextsKey = SEO_CACHE_KEYS.anchorTexts;
  try {
    const anchorTexts = await getAnchorTexts(domain);
    await writeSeoCache(anchorTextsKey, anchorTexts);
    updated.push(anchorTextsKey);
  } catch (error) {
    recordSyncError(errors, anchorTextsKey, error);
  }

  const referringDomainsKey = SEO_CACHE_KEYS.referringDomains;
  try {
    const referringDomains = await getReferringDomains(domain);
    await writeSeoCache(referringDomainsKey, referringDomains);
    updated.push(referringDomainsKey);
  } catch (error) {
    recordSyncError(errors, referringDomainsKey, error);
  }

  const competitorsKey = SEO_CACHE_KEYS.competitors(2484);
  try {
    const competitors = await getCompetitors(domain, 2484, 10);
    await writeSeoCache(competitorsKey, competitors);
    updated.push(competitorsKey);
  } catch (error) {
    recordSyncError(errors, competitorsKey, error);
  }

  await syncOnPageAudit(domain, updated, errors);
  await syncPageSpeedSummary(updated, errors);

  if (isSemrushConfigured()) {
    try {
      const semrush = await syncSemrushDomainOverview(domain);
      if (semrush) updated.push('semrush_domain_overview');
    } catch (error) {
      recordSyncError(errors, 'semrush_domain_overview', error);
    }
  }

  return {
    updated,
    errors,
    last_updated: new Date().toISOString(),
  };
}
