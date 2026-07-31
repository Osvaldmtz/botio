import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/** Fallback rates when live APIs are unavailable (approx mid-2026). */
export const FALLBACK_MXN_PER_USD = 17.5;
/** TRM aproximada; el fallback real debe estar cerca del valor oficial vigente. */
export const FALLBACK_COP_PER_USD = 3200;

const FX_CACHE_KEY = 'fx_rates_usd_v2';
const FX_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** TRM diaria publicada por Superfinanciera vía datos.gov.co (Banrep). */
const TRM_API_URL =
  'https://www.datos.gov.co/resource/ceyp-9c7c.json?$order=vigenciadesde%20DESC&$limit=1';

export type UsdFxRates = {
  mxn_per_usd: number;
  cop_per_usd: number;
  source: 'live' | 'fallback' | 'mixed';
  fetched_at: string;
};

type FrankfurterResponse = {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
};

type TrmRow = {
  valor?: string;
  vigenciadesde?: string;
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

async function fetchMxnPerUsdFromFrankfurter(): Promise<number> {
  const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=MXN', {
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    throw new Error(`Frankfurter HTTP ${res.status}`);
  }
  const json = (await res.json()) as FrankfurterResponse;
  const mxn = Number(json.rates?.MXN);
  if (!Number.isFinite(mxn) || mxn <= 0) {
    throw new Error('Frankfurter returned invalid MXN rate');
  }
  return mxn;
}

/** TRM oficial USD/COP (pesos colombianos por dólar). */
async function fetchCopPerUsdFromTrm(): Promise<number> {
  const res = await fetch(TRM_API_URL, { next: { revalidate: 0 } });
  if (!res.ok) {
    throw new Error(`TRM HTTP ${res.status}`);
  }
  const json = (await res.json()) as TrmRow[];
  const valor = Number(json[0]?.valor);
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error('TRM returned invalid COP rate');
  }
  return valor;
}

/**
 * USD→MXN via Frankfurter (ECB); USD→COP via TRM oficial (datos.gov.co).
 * Cached 24h in meta_cache. Falls back to fixed approx rates on failure.
 */
export async function getUsdFxRates(): Promise<UsdFxRates> {
  const cached = await readFxCache();
  if (cached?.mxn_per_usd && cached?.cop_per_usd) return cached;

  const [mxnResult, copResult] = await Promise.allSettled([
    fetchMxnPerUsdFromFrankfurter(),
    fetchCopPerUsdFromTrm(),
  ]);

  const mxnPerUsd =
    mxnResult.status === 'fulfilled' ? mxnResult.value : FALLBACK_MXN_PER_USD;
  const copPerUsd =
    copResult.status === 'fulfilled' ? copResult.value : FALLBACK_COP_PER_USD;

  if (mxnResult.status === 'rejected') {
    console.warn('[fx-rates] MXN unavailable, using fallback', mxnResult.reason);
  }
  if (copResult.status === 'rejected') {
    console.warn('[fx-rates] TRM unavailable, using fallback', copResult.reason);
  }

  const mxnLive = mxnResult.status === 'fulfilled';
  const copLive = copResult.status === 'fulfilled';
  const source: UsdFxRates['source'] =
    mxnLive && copLive ? 'live' : mxnLive || copLive ? 'mixed' : 'fallback';

  const payload: UsdFxRates = {
    mxn_per_usd: mxnPerUsd,
    cop_per_usd: copPerUsd,
    source,
    fetched_at: new Date().toISOString(),
  };

  if (source !== 'fallback') {
    await writeFxCache(payload);
  }

  return payload;
}

export function mxnToUsd(mxn: number, mxnPerUsd: number): number {
  if (mxn <= 0 || mxnPerUsd <= 0) return 0;
  return mxn / mxnPerUsd;
}

export function copToUsd(cop: number, copPerUsd: number): number {
  if (cop <= 0 || copPerUsd <= 0) return 0;
  return cop / copPerUsd;
}
