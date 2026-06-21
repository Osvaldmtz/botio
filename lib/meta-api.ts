import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import type { InstagramInsightPoint, InstagramMediaItem, MetaAdsInsight } from '@/lib/kpi/types';

const META_GRAPH = 'https://graph.facebook.com/v19.0';
const CACHE_TTL_MS = 4 * 60 * 60 * 1000;
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
    return cached;
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
    }>(`/${page.id}`, page.access_token, {
      fields: 'instagram_business_account,connected_instagram_account,username',
    });

    const igRef =
      pageJson.instagram_business_account ?? pageJson.connected_instagram_account;
    const igId =
      typeof igRef === 'object' && igRef !== null && 'id' in igRef ? igRef.id : undefined;

    // New Page Experience: IG fields (username) appear on the Page node when IG is linked
    // but instagram_business_account may be omitted — use Page ID as the IG node.
    const resolvedIgId = igId ?? (pageJson.username ? page.id : undefined);
    if (!resolvedIgId) continue;

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
  return data?.data ?? [];
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
  return data?.data ?? [];
}

export async function fetchInstagramInsights(
  metrics: string[],
  datePreset: string,
): Promise<InstagramInsightPoint[]> {
  const ctx = await resolveInstagramContext();
  const params = new URLSearchParams({
    access_token: ctx.page_access_token,
    metric: metrics.join(','),
    period: 'day',
    date_preset: datePreset,
  });

  const cacheKey = `ig_insights_${ctx.ig_business_account_id}_${metrics.join('_')}_${datePreset}`;
  const json = await metaFetch<{
    data: Array<{
      name: string;
      values: Array<{ value: number; end_time: string }>;
    }>;
  }>(`${META_GRAPH}/${ctx.ig_business_account_id}/insights?${params}`, cacheKey);

  const byDate = new Map<string, InstagramInsightPoint>();

  for (const series of json.data ?? []) {
    for (const point of series.values ?? []) {
      const date = point.end_time.slice(0, 10);
      const existing = byDate.get(date) ?? {
        date,
        reach: 0,
        impressions: 0,
        profile_views: 0,
        accounts_engaged: 0,
      };

      if (series.name === 'reach') existing.reach = Number(point.value) || 0;
      if (series.name === 'impressions') existing.impressions = Number(point.value) || 0;
      if (series.name === 'profile_views') existing.profile_views = Number(point.value) || 0;
      if (series.name === 'accounts_engaged') existing.accounts_engaged = Number(point.value) || 0;

      byDate.set(date, existing);
    }
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchInstagramMedia(): Promise<InstagramMediaItem[]> {
  const ctx = await resolveInstagramContext();
  const params = new URLSearchParams({
    access_token: ctx.page_access_token,
    fields:
      'id,caption,media_type,timestamp,like_count,comments_count,insights.metric(reach,engagement,saved,shares)',
    limit: '25',
  });

  const cacheKey = `ig_media_recent_${ctx.ig_business_account_id}`;
  const json = await metaFetch<{
    data: Array<{
      id: string;
      caption?: string;
      media_type?: string;
      timestamp?: string;
      like_count?: number;
      comments_count?: number;
      insights?: { data: Array<{ name: string; values: Array<{ value: number }> }> };
    }>;
  }>(`${META_GRAPH}/${ctx.ig_business_account_id}/media?${params}`, cacheKey);

  return (json.data ?? []).map((item) => {
    const insightMap = new Map(
      (item.insights?.data ?? []).map((i) => [i.name, i.values[0]?.value ?? 0]),
    );
    return {
      id: item.id,
      caption: item.caption ?? null,
      media_type: item.media_type ?? 'UNKNOWN',
      timestamp: item.timestamp ?? '',
      like_count: item.like_count ?? 0,
      comments_count: item.comments_count ?? 0,
      reach: insightMap.get('reach') ?? 0,
      engagement: insightMap.get('engagement') ?? 0,
      saved: insightMap.get('saved') ?? 0,
      shares: insightMap.get('shares') ?? 0,
    };
  });
}

export async function fetchInstagramFollowerCount(): Promise<number | null> {
  const ctx = await resolveInstagramContext();
  const params = new URLSearchParams({
    access_token: ctx.page_access_token,
    fields: 'followers_count',
  });

  try {
    const cacheKey = `ig_followers_${ctx.ig_business_account_id}`;
    const json = await metaFetch<{ followers_count?: number }>(
      `${META_GRAPH}/${ctx.ig_business_account_id}?${params}`,
      cacheKey,
    );
    return json.followers_count ?? null;
  } catch {
    return null;
  }
}
