import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import type { InstagramInsightPoint, InstagramMediaItem, MetaAdsInsight } from '@/lib/kpi/types';

const META_GRAPH = 'https://graph.facebook.com/v19.0';
const CACHE_TTL_MS = 4 * 60 * 60 * 1000;

type MetaGraphResponse<T> = {
  data?: T[];
  error?: { message: string; type?: string; code?: number };
};

function getMetaToken(): string {
  const token = process.env.META_ACCESS_TOKEN ?? process.env.META_PAGE_ACCESS_TOKEN;
  if (!token) throw new Error('Missing META_ACCESS_TOKEN or META_PAGE_ACCESS_TOKEN');
  return token;
}

function getAdAccountId(): string {
  return process.env.META_AD_ACCOUNT_ID ?? 'act_1105914435027314';
}

function getInstagramAccountId(): string {
  return process.env.META_INSTAGRAM_ACCOUNT_ID ?? '17841445123022718';
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

async function writeCache(cacheKey: string, payload: unknown): Promise<void> {
  const supabase = createAdminClient();
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();
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

async function metaFetch<T>(url: string, cacheKey: string): Promise<T> {
  const cached = await readCache<T>(cacheKey);
  if (cached) return cached;

  const res = await fetch(url, { next: { revalidate: 0 } });
  const json = (await res.json()) as MetaGraphResponse<T> & T;

  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `Meta API error (${res.status})`);
  }

  await writeCache(cacheKey, json);
  return json;
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
  const json = await metaFetch<{ data: MetaAdsInsight[] }>(
    `${META_GRAPH}/${accountId}/insights?${params}`,
    cacheKey,
  );

  return json.data ?? [];
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
  const json = await metaFetch<{ data: MetaAdsInsight[] }>(
    `${META_GRAPH}/${accountId}/insights?${params}`,
    cacheKey,
  );

  return json.data ?? [];
}

export async function fetchInstagramInsights(
  metrics: string[],
  datePreset: string,
): Promise<InstagramInsightPoint[]> {
  const token = getMetaToken();
  const igId = getInstagramAccountId();
  const params = new URLSearchParams({
    access_token: token,
    metric: metrics.join(','),
    period: 'day',
    date_preset: datePreset,
  });

  const cacheKey = `ig_insights_${metrics.join('_')}_${datePreset}`;
  const json = await metaFetch<{
    data: Array<{
      name: string;
      values: Array<{ value: number; end_time: string }>;
    }>;
  }>(`${META_GRAPH}/${igId}/insights?${params}`, cacheKey);

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
  const token = getMetaToken();
  const igId = getInstagramAccountId();
  const params = new URLSearchParams({
    access_token: token,
    fields:
      'id,caption,media_type,timestamp,like_count,comments_count,insights.metric(reach,engagement,saved,shares)',
    limit: '25',
  });

  const cacheKey = 'ig_media_recent';
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
  }>(`${META_GRAPH}/${igId}/media?${params}`, cacheKey);

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
  const token = getMetaToken();
  const igId = getInstagramAccountId();
  const params = new URLSearchParams({
    access_token: token,
    fields: 'followers_count',
  });

  try {
    const cacheKey = 'ig_followers';
    const json = await metaFetch<{ followers_count?: number }>(
      `${META_GRAPH}/${igId}?${params}`,
      cacheKey,
    );
    return json.followers_count ?? null;
  } catch {
    return null;
  }
}
