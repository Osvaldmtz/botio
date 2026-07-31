/**
 * Sprint B — trial→paid funnel diagnostic (Botio drip + Kalyo product engagement).
 *
 *   npx tsx scripts/trial-funnel-diagnostic.ts
 *   npx tsx scripts/trial-funnel-diagnostic.ts --days=30 --out=reports/trial-funnel.json
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (Botio)
 *      KALYO_SUPABASE_URL, KALYO_SUPABASE_SERVICE_KEY (Kalyo, optional but recommended)
 */
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  buildTrialFunnelReport,
  formatTrialFunnelReport,
  TRIAL_FUNNEL_DEFAULT_DAYS,
} from '../lib/trial-funnel-diagnostic';
import { getKalyoClient } from '../lib/kalyo-supabase';

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
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

function parseArgs(argv: string[]): { days: number; out: string | null } {
  let days = TRIAL_FUNNEL_DEFAULT_DAYS;
  let out: string | null = null;
  for (const arg of argv) {
    if (arg.startsWith('--days=')) {
      days = Math.max(1, parseInt(arg.slice('--days='.length), 10) || TRIAL_FUNNEL_DEFAULT_DAYS);
    } else if (arg.startsWith('--out=')) {
      out = arg.slice('--out='.length);
    }
  }
  return { days, out };
}

function createBotioClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function main(): Promise<void> {
  loadEnvFile(join(process.cwd(), '.env.local'));
  loadEnvFile(join(process.cwd(), '.env.vercel'));

  const { days, out } = parseArgs(process.argv.slice(2));
  const botio = createBotioClient();

  let kalyo = null;
  try {
    kalyo = getKalyoClient();
    console.log('[trial-funnel] Kalyo client OK — product engagement enabled');
  } catch {
    console.warn('[trial-funnel] Kalyo creds missing — Botio drip only');
  }

  console.log(`[trial-funnel] Running ${days}-day diagnostic…`);
  const report = await buildTrialFunnelReport(botio, { days, kalyo });

  const markdown = formatTrialFunnelReport(report);
  console.log('\n' + markdown);

  const jsonPath =
    out ?? join(process.cwd(), 'reports', `trial-funnel-${new Date().toISOString().slice(0, 10)}.json`);
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`\n[trial-funnel] JSON → ${jsonPath}`);

  const paid = report.botio.drip_funnel.find((s) => s.step === 'paid_onboarding')?.count ?? 0;
  const total = report.botio.drip_funnel.find((s) => s.step === 'total')?.count ?? 0;
  console.log(`[trial-funnel] Summary: ${total} trials, ${paid} paid via onboarding, ${report.paid_outside_onboarding.length} paid outside drip`);
}

void main().catch((err) => {
  console.error('[trial-funnel] failed', err);
  process.exit(1);
});
