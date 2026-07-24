import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/** Fallback rates when Frankfurter is unavailable (approx mid-2026). */
export const FALLBACK_MXN_PER_USD = 17.5;
export const FALLBACK_COP_PER_USD = 4100;

const FX_CACHE_KEY = 'fx_rates_usd';
const FX_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type UsdFxRates = {
  mxn_per_usd: number;
  cop_per_usd: number;
  source: 'frankfurter' | 'fallback';
  fetched_at: string;
};

type FrankfurterResponse = {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
};

async function readFxCache(): Promise<UsdFxRates | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('meta_cache')
    .select('payload, expires_at')
    .eq('cache_key', FX_CACHE_KEY)
    .maybeSingle();

  if (!data?.payload || !data.expires_at) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) return null;
  return data.payload as UsdFxRates;
}

async function writeFxCache(payload: UsdFxRates): Promise<void> {
  const supabase = createAdminClient();
  const expiresAt = new Date(Date.now() + FX_CACHE_TTL_MS).toISOString();
  await supabase.from('meta_cache').upsert(
    {
      cache_key: FX_CACHE_KEY,
      payload: payload as unknown as Record<string, unknown>,
      cached_at: new Date().toISOString(),
      expires_at: expiresAt,
    },
    { onConflict: 'cache_key' },
  );
}

/**
 * Daily USD→MXN / USD→COP rates via Frankfurter (ECB).
 * Cached 24h in meta_cache. Falls back to fixed approx rates on failure.
 */
export async function getUsdFxRates(): Promise<UsdFxRates> {
  const cached = await readFxCache();
  if (cached?.mxn_per_usd && cached?.cop_per_usd) return cached;

  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=MXN,COP', {
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      throw new Error(`Frankfurter HTTP ${res.status}`);
    }
    const json = (await res.json()) as FrankfurterResponse;
    const mxn = Number(json.rates?.MXN);
    const cop = Number(json.rates?.COP);
    if (!Number.isFinite(mxn) || mxn <= 0 || !Number.isFinite(cop) || cop <= 0) {
      throw new Error('Frankfurter returned invalid MXN/COP rates');
    }

    const payload: UsdFxRates = {
      mxn_per_usd: mxn,
      cop_per_usd: cop,
      source: 'frankfurter',
      fetched_at: new Date().toISOString(),
    };
    await writeFxCache(payload);
    return payload;
  } catch (err) {
    console.warn('[fx-rates] Frankfurter unavailable, using fallbacks', err);
    return {
      mxn_per_usd: FALLBACK_MXN_PER_USD,
      cop_per_usd: FALLBACK_COP_PER_USD,
      source: 'fallback',
      fetched_at: new Date().toISOString(),
    };
  }
}

export function mxnToUsd(mxn: number, mxnPerUsd: number): number {
  if (mxn <= 0 || mxnPerUsd <= 0) return 0;
  return mxn / mxnPerUsd;
}

export function copToUsd(cop: number, copPerUsd: number): number {
  if (cop <= 0 || copPerUsd <= 0) return 0;
  return cop / copPerUsd;
}
