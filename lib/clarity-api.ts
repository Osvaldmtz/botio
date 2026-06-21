import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

const CLARITY_API = 'https://www.clarity.ms/export-data/api/v1/project-live-insights';
const CACHE_KEY = 'clarity_metrics';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export type ClarityMetrics = {
  totalSessions: number;
  botSessions: number;
  botRate: number;
  realSessions: number;
  uniqueUsers: number;
  pagesPerSession: number;
  scrollDepth: number;
  activeTimeSec: number;
  rageClicks: number;
  deadClicks: number;
  quickBacks: number;
  excessiveScrolling: number;
  period: string;
  numOfDays: 1 | 2 | 3;
};

type ClarityMetricBlock = {
  metricName: string;
  information: Record<string, string | number | null>[];
};

function getToken(): string {
  const token = process.env.CLARITY_API_TOKEN?.trim();
  if (!token) throw new Error('Missing CLARITY_API_TOKEN');
  return token;
}

function getProjectId(): string {
  const id = process.env.CLARITY_PROJECT_ID?.trim();
  if (!id) throw new Error('Missing CLARITY_PROJECT_ID');
  return id;
}

function parseNum(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

function findMetric(blocks: ClarityMetricBlock[], name: string): ClarityMetricBlock | undefined {
  return blocks.find((b) => b.metricName === name);
}

function firstInfo(blocks: ClarityMetricBlock[], name: string): Record<string, string | number | null> {
  return findMetric(blocks, name)?.information?.[0] ?? {};
}

function parseClarityResponse(blocks: ClarityMetricBlock[], numOfDays: 1 | 2 | 3): ClarityMetrics {
  const traffic = firstInfo(blocks, 'Traffic');
  const realSessions = Math.round(parseNum(traffic.totalSessionCount));
  const botSessions = Math.round(parseNum(traffic.totalBotSessionCount));
  const combinedTotal = realSessions + botSessions;
  const botRate = combinedTotal > 0 ? (botSessions / combinedTotal) * 100 : 0;

  const scroll = firstInfo(blocks, 'ScrollDepth');
  const engagement = firstInfo(blocks, 'EngagementTime');
  const rage = firstInfo(blocks, 'RageClickCount');
  const dead = firstInfo(blocks, 'DeadClickCount');
  const quick = firstInfo(blocks, 'QuickbackClick');
  const excessive = firstInfo(blocks, 'ExcessiveScroll');

  const activeTimeRaw = parseNum(engagement.activeTime);
  const activeTimeSec =
    realSessions > 0 && activeTimeRaw > realSessions * 60
      ? Math.round(activeTimeRaw / realSessions)
      : Math.round(activeTimeRaw);

  return {
    totalSessions: combinedTotal,
    botSessions,
    botRate: Math.round(botRate * 100) / 100,
    realSessions,
    uniqueUsers: Math.round(parseNum(traffic.distinctUserCount)),
    pagesPerSession: Math.round(parseNum(traffic.pagesPerSessionPercentage) * 100) / 100,
    scrollDepth: Math.round(parseNum(scroll.averageScrollDepth) * 100) / 100,
    activeTimeSec,
    rageClicks: Math.round(parseNum(rage.sessionsWithMetricPercentage) * 100) / 100,
    deadClicks: Math.round(parseNum(dead.sessionsWithMetricPercentage) * 100) / 100,
    quickBacks: Math.round(parseNum(quick.sessionsWithMetricPercentage) * 100) / 100,
    excessiveScrolling: Math.round(parseNum(excessive.sessionsWithMetricPercentage) * 100) / 100,
    period: `last_${numOfDays}_days`,
    numOfDays,
  };
}

async function readCache(numOfDays: 1 | 2 | 3): Promise<ClarityMetrics | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('meta_cache')
    .select('payload, expires_at')
    .eq('cache_key', CACHE_KEY)
    .maybeSingle();

  if (!data?.payload || !data.expires_at) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) return null;

  const cached = data.payload as ClarityMetrics;
  if (cached.numOfDays !== numOfDays) return null;
  return cached;
}

async function writeCache(metrics: ClarityMetrics): Promise<void> {
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

async function fetchClarityRaw(numOfDays: 1 | 2 | 3): Promise<ClarityMetricBlock[]> {
  const params = new URLSearchParams({
    numOfDays: String(numOfDays),
    projectId: getProjectId(),
  });

  const res = await fetch(`${CLARITY_API}?${params}`, {
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Clarity API error (${res.status}): ${detail || res.statusText}`);
  }

  return (await res.json()) as ClarityMetricBlock[];
}

export async function getClarityMetrics(
  numOfDays: 1 | 2 | 3,
  options?: { skipCache?: boolean },
): Promise<ClarityMetrics> {
  if (!options?.skipCache) {
    const cached = await readCache(numOfDays);
    if (cached) return cached;
  }

  const blocks = await fetchClarityRaw(numOfDays);
  const metrics = parseClarityResponse(blocks, numOfDays);
  await writeCache(metrics);
  return metrics;
}

export async function syncClarityMetrics(): Promise<{
  date: string;
  metrics: ClarityMetrics;
}> {
  const metrics = await getClarityMetrics(1, { skipCache: true });
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  const dateStr = date.toISOString().slice(0, 10);

  const supabase = createAdminClient();
  const { error } = await supabase.from('clarity_metrics').upsert(
    {
      date: dateStr,
      real_sessions: metrics.realSessions,
      bot_sessions: metrics.botSessions,
      bot_rate: metrics.botRate,
      scroll_depth: metrics.scrollDepth,
      active_time_sec: metrics.activeTimeSec,
      rage_clicks: metrics.rageClicks,
      dead_clicks: metrics.deadClicks,
      quick_backs: metrics.quickBacks,
      pages_per_session: metrics.pagesPerSession,
      synced_at: new Date().toISOString(),
    },
    { onConflict: 'date' },
  );

  if (error) throw new Error(error.message);

  return { date: dateStr, metrics };
}
