import { dirname, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { fetchMetricsBundle } from '../lib/metrics-queries';
import { getMRRCached } from '../lib/stripe-mrr';
import { generateInsights } from '../lib/dashboard-insights';

function loadEnvLocal(): void {
  const envPath = join(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing Supabase env');
  process.exit(1);
}

const supabaseUrl = url;
const supabaseKey = key;

async function main(): Promise<void> {
  console.log('[test] metrics API structure\n');
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [mrr, metrics] = await Promise.all([getMRRCached(), fetchMetricsBundle(supabase)]);
  const insights = generateInsights(metrics, mrr);

  assert(typeof mrr.current_mrr_usd === 'number', 'mrr.current_mrr_usd');
  assert(typeof metrics.funnel.leads === 'number', 'funnel.leads');
  assert(typeof metrics.funnel.conversion_rates.overall === 'number', 'funnel rates');
  assert(metrics.by_channel.whatsapp !== undefined, 'by_channel.whatsapp');
  assert(Array.isArray(metrics.top_objections), 'top_objections array');
  assert(Array.isArray(metrics.trends_30d), 'trends_30d array');
  assert(metrics.trends_30d.length === 30, 'trends_30d has 30 days');
  assert(Array.isArray(insights), 'insights array');
  assert(insights.length > 0, 'insights generated');

  console.log('[test] mrr.available:', mrr.available);
  console.log('[test] mrr.current_mrr_usd:', mrr.current_mrr_usd);
  console.log('[test] funnel.leads:', metrics.funnel.leads);
  console.log('[test] funnel.paid:', metrics.funnel.paid);
  console.log('[test] insights:', insights.length);
  if (mrr.available && mrr.active_subscriptions > 0) {
    assert(mrr.current_mrr_usd >= 0, 'MRR should be >= 0 when subs exist');
  }
  console.log('[test] ALL PASSED');
}

void main().catch((err) => {
  console.error('[test] FAILED', err);
  process.exit(1);
});
