import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import type { InstagramInsightPoint, InstagramMediaItem, MetaAdsInsight } from '@/lib/kpi/types';

const META_GRAPH = 'https://graph.facebook.com/v19.0';
const CACHE_TTL_MS = 4 * 60 * 60 * 1000;
/** Meta ad account act_1105914435027314 bills in Mexican pesos */
export const META_ADS_CURRENCY = 'MXN' as const;

function withAdsCurrency(rows: MetaAdsInsight[]): MetaAdsInsight[] {
  return rows.map((row) => ({ ...row, currency: META_ADS_CURRENCY }));
}
const IG_CONTEXT_CACHE_KEY = 'ig_context';
const IG_CONTEXT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type MetaGraphError = { message: string; type?: string; code?: number };
type MetaGraphResponse<T> = {
  data?: T[];
  error?: MetaGraphError;
};

type InstagramBusinessAccountRef = {
  id: string;
  username?: string;
};

type FacebookPageAccount = {
  id: string;
  name?: string;
  access_token?: string;
};

/** Cached Instagram context: page token + discovered IG Business Account ID. */
export type CachedInstagramContext = {
  page_id: string;
  page_name?: string;
  page_access_token: string;
  ig_business_account_id: string;
  ig_username?: string;
  /** True when ig_business_account_id is a real IG node (not the Facebook Page ID). */
  uses_instagram_graph: boolean;
};

/** @deprecated Use CachedInstagramContext */
type CachedInstagramAccount = {
  id: string;
  page_id: string;
  page_name?: string;
  username?: string;
};

export type MetaTokenInspection = {
  me: Record<string, unknown> | { error: MetaGraphError };
  permissions: Record<string, unknown> | { error: MetaGraphError };
  instagramDiscovery: {
    pages_checked: number;
    account: CachedInstagramAccount | null;
    error: string | null;
  };
  adsProbe: {
    ok: boolean;
    error: string | null;
    row_count: number;
  };
};

function getMetaToken(): string {
  const token = process.env.META_ACCESS_TOKEN ?? process.env.META_PAGE_ACCESS_TOKEN;
  if (!token) throw new Error('Missing META_ACCESS_TOKEN or META_PAGE_ACCESS_TOKEN');
  return token;
}

function getUserMetaToken(): string {
  const token = process.env.META_ACCESS_TOKEN?.trim();
  if (!token) throw new Error('Missing META_ACCESS_TOKEN');
  return token;
}

function getAdAccountId(): string {
  return process.env.META_AD_ACCOUNT_ID ?? 'act_1105914435027314';
}

function isAdsPermissionError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('ads_management') ||
    lower.includes('ads_read') ||
    lower.includes('ad account owner') ||
    lower.includes('permission')
  );
}

function preferKalyoPage(pages: FacebookPageAccount[]): FacebookPageAccount[] {
  return [...pages].sort((a, b) => {
    const aScore = a.name?.toLowerCase().includes('kalyo') ? 0 : 1;
    const bScore = b.name?.toLowerCase().includes('kalyo') ? 0 : 1;
    return aScore - bScore;
  });
}

async function readCache<T>(cacheKey: string): Promise<T | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('meta_cache')
    .select('payload, expires_at')
    .eq('cache_key', cacheKey)
    .maybeSingle();

  if (!data?.payload || !data.expires_at) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) return null;
  return data.payload as T;
}

async function writeCache(cacheKey: string, payload: unknown, ttlMs = CACHE_TTL_MS): Promise<void> {
  const supabase = createAdminClient();
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  await supabase.from('meta_cache').upsert(
    {
      cache_key: cacheKey,
      payload: payload as Record<string, unknown>,
      cached_at: new Date().toISOString(),
      expires_at: expiresAt,
    },
    { onConflict: 'cache_key' },
  );
}

async function metaGraphGet<T extends Record<string, unknown>>(
  path: string,
  accessToken: string,
  searchParams?: Record<string, string>,
): Promise<T> {
  const params = new URLSearchParams({ access_token: accessToken, ...searchParams });
  const res = await fetch(`${META_GRAPH}${path}?${params}`, { next: { revalidate: 0 } });
  const json = (await res.json()) as T & { error?: MetaGraphError };

  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `Meta API error (${res.status})`);
  }

  return json;
}

async function metaFetch<T>(url: string, cacheKey: string): Promise<T> {
  const cached = await readCache<T>(cacheKey);
  if (cached) return cached;

  const res = await fetch(url, { next: { revalidate: 0 } });
  const json = (await res.json()) as MetaGraphResponse<T> & T & { error?: MetaGraphError };

  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `Meta API error (${res.status})`);
  }

  await writeCache(cacheKey, json);
  return json;
}

async function metaFetchAds<T>(url: string, cacheKey: string): Promise<{ data: T | null; error: string | null }> {
  try {
    const data = await metaFetch<T>(url, cacheKey);
    return { data, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isAdsPermissionError(message)) {
      console.warn('[meta-api] Ads API unavailable:', message);
      return { data: null, error: message };
    }
    throw err;
  }
}

/**
 * Resolve Instagram context via User token → Page list → Page token → IG Business Account.
 * Cached 24h in meta_cache (page_id, page_access_token, ig_business_account_id).
 */
export async function resolveInstagramContext(): Promise<CachedInstagramContext> {
  const cached = await readCache<CachedInstagramContext>(IG_CONTEXT_CACHE_KEY);
  if (cached?.page_access_token && cached?.ig_business_account_id) {
    return {
      ...cached,
      uses_instagram_graph:
        cached.uses_instagram_graph ??
        cached.ig_business_account_id !== cached.page_id,
    };
  }

  const userToken = getUserMetaToken();
  const accountsJson = await metaGraphGet<{ data: FacebookPageAccount[] }>(
    '/me/accounts',
    userToken,
    { fields: 'id,name,access_token' },
  );

  const pages = preferKalyoPage(accountsJson.data ?? []);
  if (pages.length === 0) {
    throw new Error('No Facebook Pages returned by /me/accounts');
  }

  for (const page of pages) {
    if (!page.access_token) continue;

    const pageJson = await metaGraphGet<{
      id?: string;
      username?: string;
      instagram_business_account?: InstagramBusinessAccountRef | { id?: string };
      connected_instagram_account?: InstagramBusinessAccountRef | { id?: string };
      page_backed_instagram_accounts?: { data?: Array<{ id: string }> };
    }>(`/${page.id}`, page.access_token, {
      fields:
        'instagram_business_account,connected_instagram_account,page_backed_instagram_accounts,username',
    });

    const backedIgId = pageJson.page_backed_instagram_accounts?.data?.[0]?.id;
    const igRef =
      pageJson.instagram_business_account ?? pageJson.connected_instagram_account;
    const linkedIgId =
      typeof igRef === 'object' && igRef !== null && 'id' in igRef ? igRef.id : undefined;

    // Prefer linked IG Business Account — token grants access via instagram_business_account,
    // while page_backed_instagram_accounts may reference a node the app cannot query.
    const resolvedIgId = linkedIgId ?? backedIgId ?? (pageJson.username ? page.id : undefined);
    if (!resolvedIgId) continue;

    const usesInstagramGraph = Boolean(linkedIgId ?? backedIgId);

    const igUsername =
      typeof igRef === 'object' &&
      igRef !== null &&
      'username' in igRef &&
      typeof igRef.username === 'string'
        ? igRef.username
        : pageJson.username;

    const context: CachedInstagramContext = {
      page_id: page.id,
      page_name: page.name,
      page_access_token: page.access_token,
      ig_business_account_id: resolvedIgId,
      ig_username: igUsername,
      uses_instagram_graph: usesInstagramGraph,
    };

    await writeCache(IG_CONTEXT_CACHE_KEY, context, IG_CONTEXT_CACHE_TTL_MS);
    return context;
  }

  throw new Error(
    'No Instagram Business Account linked to any Facebook Page returned by /me/accounts',
  );
}

/** @deprecated Use resolveInstagramContext */
export async function discoverInstagramBusinessAccount(): Promise<CachedInstagramAccount> {
  const ctx = await resolveInstagramContext();
  return {
    id: ctx.ig_business_account_id,
    page_id: ctx.page_id,
    page_name: ctx.page_name,
    username: ctx.ig_username,
  };
}

export async function inspectMetaToken(): Promise<MetaTokenInspection> {
  const token = getMetaToken();
  const baseParams = new URLSearchParams({ access_token: token });

  const [meRes, permRes] = await Promise.all([
    fetch(`${META_GRAPH}/me?fields=id,name&${baseParams}`, { next: { revalidate: 0 } }),
    fetch(`${META_GRAPH}/me/permissions?${baseParams}`, { next: { revalidate: 0 } }),
  ]);

  const meJson = (await meRes.json()) as Record<string, unknown> & { error?: MetaGraphError };
  const permJson = (await permRes.json()) as Record<string, unknown> & { error?: MetaGraphError };

  const instagramDiscovery: MetaTokenInspection['instagramDiscovery'] = {
    pages_checked: 0,
    account: null,
    error: null,
  };

  try {
    const ctx = await resolveInstagramContext();
    instagramDiscovery.pages_checked = 1;
    instagramDiscovery.account = {
      id: ctx.ig_business_account_id,
      page_id: ctx.page_id,
      page_name: ctx.page_name,
      username: ctx.ig_username,
    };
  } catch (err) {
    instagramDiscovery.error = err instanceof Error ? err.message : String(err);
  }

  const accountId = getAdAccountId();
  const adsParams = new URLSearchParams({
    access_token: token,
    fields: 'spend',
    date_preset: 'today',
    level: 'account',
  });
  const adsRes = await fetch(`${META_GRAPH}/${accountId}/insights?${adsParams}`, {
    next: { revalidate: 0 },
  });
  const adsJson = (await adsRes.json()) as { data?: MetaAdsInsight[]; error?: MetaGraphError };

  const adsProbe: MetaTokenInspection['adsProbe'] = {
    ok: !adsJson.error && adsRes.ok,
    error: adsJson.error?.message ?? (!adsRes.ok ? `HTTP ${adsRes.status}` : null),
    row_count: adsJson.data?.length ?? 0,
  };

  const permissionsPayload = permJson.error
    ? { error: permJson.error, note: 'Token type may not support /me/permissions (e.g. Page token)' }
    : {
        ...permJson,
        granted: (
          (permJson.data as Array<{ permission: string; status: string }> | undefined) ?? []
        )
          .filter((p) => p.status === 'granted')
          .map((p) => p.permission),
      };

  return {
    me: meJson.error ? { error: meJson.error } : meJson,
    permissions: permissionsPayload,
    instagramDiscovery,
    adsProbe,
  };
}

export async function fetchMetaAds(datePreset: string): Promise<MetaAdsInsight[]> {
  const token = getMetaToken();
  const accountId = getAdAccountId();
  const params = new URLSearchParams({
    access_token: token,
    fields: 'spend,impressions,clicks,cpm,cpc,ctr,reach,date_start,date_stop',
    date_preset: datePreset,
    level: 'account',
  });

  const cacheKey = `meta_ads_${datePreset}`;
  const { data, error } = await metaFetchAds<{ data: MetaAdsInsight[] }>(
    `${META_GRAPH}/${accountId}/insights?${params}`,
    cacheKey,
  );

  if (error) return [];
  return withAdsCurrency(data?.data ?? []);
}

export async function fetchMetaAdsDaily(datePreset = 'last_30d'): Promise<MetaAdsInsight[]> {
  const token = getMetaToken();
  const accountId = getAdAccountId();
  const params = new URLSearchParams({
    access_token: token,
    fields: 'spend,impressions,clicks,cpm,cpc,ctr,reach,date_start,date_stop',
    date_preset: datePreset,
    level: 'account',
    time_increment: '1',
  });

  const cacheKey = `meta_ads_daily_${datePreset}`;
  const { data, error } = await metaFetchAds<{ data: MetaAdsInsight[] }>(
    `${META_GRAPH}/${accountId}/insights?${params}`,
    cacheKey,
  );

  if (error) return [];
  return withAdsCurrency(data?.data ?? []);
}

/** Facebook Page Insights metrics (New Page Experience — replaces deprecated IG metrics). */
const PAGE_INSIGHT_METRIC_MAP = {
  reach: 'page_total_media_view_unique',
  impressions: 'page_media_view',
  engagements: 'page_post_engagements',
} as const;

type PageInsightSeries = Array<{ value: number; end_time: string }>;

async function fetchPageInsightSeries(
  pageId: string,
  pageToken: string,
  metric: string,
  datePreset: string,
): Promise<PageInsightSeries> {
  const params = new URLSearchParams({
    access_token: pageToken,
    metric,
    period: 'day',
    date_preset: datePreset,
  });

  const cacheKey = `page_insights_${pageId}_${metric}_${datePreset}`;
  const json = await metaFetch<{
    data: Array<{ name: string; values: PageInsightSeries }>;
  }>(`${META_GRAPH}/${pageId}/insights?${params}`, cacheKey);

  return json.data?.[0]?.values ?? [];
}

function mergePageInsightPoints(
  reach: PageInsightSeries,
  impressions: PageInsightSeries,
  engagements: PageInsightSeries,
): InstagramInsightPoint[] {
  const byDate = new Map<string, InstagramInsightPoint>();

  const upsert = (series: PageInsightSeries, field: 'reach' | 'impressions' | 'accounts_engaged') => {
    for (const point of series) {
      const date = point.end_time.slice(0, 10);
      const existing = byDate.get(date) ?? {
        date,
        reach: 0,
        impressions: 0,
        profile_views: 0,
        accounts_engaged: 0,
      };
      existing[field] = Number(point.value) || 0;
      byDate.set(date, existing);
    }
  };

  upsert(reach, 'reach');
  upsert(impressions, 'impressions');
  upsert(engagements, 'accounts_engaged');

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchInstagramInsights(
  _metrics?: string[],
  datePreset = 'last_30d',
): Promise<InstagramInsightPoint[]> {
  const ctx = await resolveInstagramContext();

  if (ctx.uses_instagram_graph) {
    return fetchInstagramGraphInsights(
      ctx.ig_business_account_id,
      ctx.page_access_token,
      datePreset,
    );
  }

  const [reach, impressions, engagements] = await Promise.all([
    fetchPageInsightSeries(ctx.page_id, ctx.page_access_token, PAGE_INSIGHT_METRIC_MAP.reach, datePreset),
    fetchPageInsightSeries(ctx.page_id, ctx.page_access_token, PAGE_INSIGHT_METRIC_MAP.impressions, datePreset),
    fetchPageInsightSeries(
      ctx.page_id,
      ctx.page_access_token,
      PAGE_INSIGHT_METRIC_MAP.engagements,
      datePreset,
    ),
  ]);

  return mergePageInsightPoints(reach, impressions, engagements);
}

type IgGraphInsightMetric = {
  name: string;
  values?: Array<{ value: number; end_time: string }>;
  total_value?: { value: number };
};

function totalValueFromMetrics(metrics: IgGraphInsightMetric[], name: string): number {
  const metric = metrics.find((m) => m.name === name);
  return Number(metric?.total_value?.value) || 0;
}

function mergeInstagramGraphInsights(
  reachMetrics: IgGraphInsightMetric[],
  aggregateMetrics: IgGraphInsightMetric[],
  views7d: number,
  accountsEngaged7d: number,
): InstagramInsightPoint[] {
  const reachSeries = reachMetrics.find((m) => m.name === 'reach')?.values ?? [];
  const viewsTotal = totalValueFromMetrics(aggregateMetrics, 'views');
  const profileViewsTotal = totalValueFromMetrics(aggregateMetrics, 'profile_views');
  const accountsEngagedTotal = totalValueFromMetrics(aggregateMetrics, 'accounts_engaged');

  if (reachSeries.length === 0) {
    return [];
  }

  const viewsPerDay = viewsTotal > 0 ? viewsTotal / reachSeries.length : 0;
  const points: InstagramInsightPoint[] = reachSeries.map((point) => ({
    date: point.end_time.slice(0, 10),
    reach: Number(point.value) || 0,
    impressions: viewsPerDay,
    profile_views: 0,
    accounts_engaged: 0,
  }));

  const latest = points[points.length - 1];
  latest.profile_views = profileViewsTotal;
  latest.accounts_engaged = accountsEngagedTotal;

  // 7d card metrics sum slice(-7); attribute period totals to recent points only.
  const recentPoints = points.slice(-7);
  if (recentPoints.length > 0 && views7d > 0) {
    const viewsPerRecentDay = views7d / recentPoints.length;
    for (const point of recentPoints) {
      point.impressions = viewsPerRecentDay;
    }
  }
  if (recentPoints.length > 0 && accountsEngaged7d > 0) {
    const engagedPerRecentDay = accountsEngaged7d / recentPoints.length;
    for (const point of recentPoints) {
      point.accounts_engaged = engagedPerRecentDay;
    }
  }

  return points;
}

async function fetchInstagramGraphInsights(
  igId: string,
  pageToken: string,
  datePreset: string,
): Promise<InstagramInsightPoint[]> {
  const reachParams = new URLSearchParams({
    access_token: pageToken,
    metric: 'reach',
    period: 'day',
    date_preset: datePreset,
  });
  const aggregateParams = new URLSearchParams({
    access_token: pageToken,
    metric: 'views,profile_views,accounts_engaged',
    metric_type: 'total_value',
    period: 'day',
    date_preset: datePreset,
  });
  const aggregate7dParams = new URLSearchParams({
    access_token: pageToken,
    metric: 'views,accounts_engaged',
    metric_type: 'total_value',
    period: 'day',
    date_preset: 'last_7d',
  });

  const [reachJson, aggregateJson, aggregate7dJson] = await Promise.all([
    metaFetch<{ data: IgGraphInsightMetric[] }>(
      `${META_GRAPH}/${igId}/insights?${reachParams}`,
      `ig_graph_reach_${igId}_${datePreset}`,
    ),
    metaFetch<{ data: IgGraphInsightMetric[] }>(
      `${META_GRAPH}/${igId}/insights?${aggregateParams}`,
      `ig_graph_agg_${igId}_${datePreset}`,
    ),
    metaFetch<{ data: IgGraphInsightMetric[] }>(
      `${META_GRAPH}/${igId}/insights?${aggregate7dParams}`,
      `ig_graph_agg_${igId}_last_7d`,
    ),
  ]);

  return mergeInstagramGraphInsights(
    reachJson.data ?? [],
    aggregateJson.data ?? [],
    totalValueFromMetrics(aggregate7dJson.data ?? [], 'views'),
    totalValueFromMetrics(aggregate7dJson.data ?? [], 'accounts_engaged'),
  );
}

async function fetchInstagramGraphMedia(
  igId: string,
  pageToken: string,
): Promise<InstagramMediaItem[]> {
  const params = new URLSearchParams({
    access_token: pageToken,
    fields: 'id,caption,media_type,timestamp,like_count,comments_count,reach,impressions,saved',
    limit: '25',
  });

  const cacheKey = `ig_graph_media_${igId}`;
  const json = await metaFetch<{
    data: Array<{
      id: string;
      caption?: string;
      media_type?: string;
      timestamp?: string;
      like_count?: number;
      comments_count?: number;
      reach?: number;
      impressions?: number;
      saved?: number;
    }>;
  }>(`${META_GRAPH}/${igId}/media?${params}`, cacheKey);

  return (json.data ?? []).map((item) => ({
    id: item.id,
    caption: item.caption ?? null,
    media_type: item.media_type ?? 'UNKNOWN',
    timestamp: item.timestamp ?? '',
    like_count: item.like_count ?? 0,
    comments_count: item.comments_count ?? 0,
    reach: item.reach ?? 0,
    engagement: (item.like_count ?? 0) + (item.comments_count ?? 0) + (item.saved ?? 0),
    saved: item.saved ?? 0,
    shares: 0,
  }));
}

export async function fetchInstagramMedia(): Promise<InstagramMediaItem[]> {
  const ctx = await resolveInstagramContext();

  if (ctx.uses_instagram_graph) {
    return fetchInstagramGraphMedia(ctx.ig_business_account_id, ctx.page_access_token);
  }

  const params = new URLSearchParams({
    access_token: ctx.page_access_token,
    fields: 'id,message,created_time',
    limit: '25',
  });

  const cacheKey = `page_posts_${ctx.page_id}`;
  const json = await metaFetch<{
    data: Array<{
      id: string;
      message?: string;
      created_time?: string;
    }>;
  }>(`${META_GRAPH}/${ctx.page_id}/posts?${params}`, cacheKey);

  return (json.data ?? []).map((item) => ({
    id: item.id,
    caption: item.message ?? null,
    media_type: 'POST',
    timestamp: item.created_time ?? '',
    like_count: 0,
    comments_count: 0,
    reach: 0,
    engagement: 0,
    saved: 0,
    shares: 0,
  }));
}

export async function fetchInstagramFollowerCount(): Promise<number | null> {
  const ctx = await resolveInstagramContext();

  if (ctx.uses_instagram_graph) {
    try {
      const cacheKey = `ig_graph_followers_${ctx.ig_business_account_id}`;
      const json = await metaFetch<{ followers_count?: number }>(
        `${META_GRAPH}/${ctx.ig_business_account_id}?${new URLSearchParams({
          access_token: ctx.page_access_token,
          fields: 'followers_count,username',
        })}`,
        cacheKey,
      );
      if (json.followers_count != null) return json.followers_count;
    } catch {
      // fall through to page fan_count
    }
  }

  try {
    const cacheKey = `page_fan_count_${ctx.page_id}`;
    const json = await metaFetch<{ fan_count?: number; followers_count?: number }>(
      `${META_GRAPH}/me?${new URLSearchParams({
        access_token: ctx.page_access_token,
        fields: 'fan_count,followers_count',
      })}`,
      cacheKey,
    );
    return json.fan_count ?? json.followers_count ?? null;
  } catch {
    return null;
  }
}
