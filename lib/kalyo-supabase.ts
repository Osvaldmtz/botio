import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function getKalyoClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.KALYO_SUPABASE_URL;
  const key = process.env.KALYO_SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('Missing KALYO_SUPABASE_URL or KALYO_SUPABASE_SERVICE_KEY');
  }
  cached = createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
