import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  pickVariant,
  uniformTrafficSplit,
  assignVariant,
  getExperimentResults,
  type Experiment,
} from '../lib/ab-testing';

const EXPERIMENT_ID = '8bda62a2-8fb6-4a25-a64d-131ea6bbd08b';
const KALYO_BOT_ID = '64f6eed2-1522-48fe-a2c6-f858b767df06';

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

async function createTestConversation(
  supabase: SupabaseClient,
  phone: string,
): Promise<string> {
  const id = randomUUID();
  const { error } = await supabase.from('conversations').insert({
    id,
    bot_id: KALYO_BOT_ID,
    customer_phone: phone,
    channel: 'whatsapp',
    pipeline_stage: 'new',
  });
  if (error) throw error;
  return id;
}

async function cleanupConversations(supabase: SupabaseClient, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await supabase.from('ab_outcomes').delete().in(
    'assignment_id',
    (
      await supabase
        .from('ab_assignments')
        .select('id')
        .in('conversation_id', ids)
    ).data?.map((r) => r.id) ?? [],
  );
  await supabase.from('ab_assignments').delete().in('conversation_id', ids);
  await supabase.from('messages').delete().in('conversation_id', ids);
  await supabase.from('conversations').delete().in('id', ids);
}

async function main(): Promise<void> {
  console.log('[test] A/B saludos 5 variantes\n');
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const split = { A: 0.2, B: 0.2, C: 0.2, D: 0.2, E: 0.2 };
  const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (let i = 0; i < 500; i++) {
    const v = pickVariant(split);
    counts[v] = (counts[v] ?? 0) + 1;
  }
  console.log('[test] distribution 500 picks:', counts);
  for (const v of ['A', 'B', 'C', 'D', 'E']) {
    const pct = (counts[v] / 500) * 100;
    assert(pct >= 12 && pct <= 28, `Variant ${v} out of range: ${pct}%`);
  }

  const uniform = uniformTrafficSplit(['A', 'B', 'C', 'D', 'E']);
  assert(Object.keys(uniform).length === 5, 'uniform split keys');
  assert(Math.abs(uniform.A - 0.2) < 0.001, 'uniform weight');

  const { data: experiment, error: expErr } = await supabase
    .from('ab_experiments')
    .select('*')
    .eq('id', EXPERIMENT_ID)
    .single();
  if (expErr) throw expErr;
  const exp = experiment as Experiment;
  assert(exp.name.includes('5 variantes'), 'experiment name updated');
  assert(Object.keys(exp.variants).length === 5, '5 variants in DB');
  assert(exp.traffic_split.E === 0.2, 'traffic split E = 0.2');
  console.log('[test] DB experiment OK:', exp.name);

  const testIds: string[] = [];
  const phone = `+5299${Date.now().toString().slice(-8)}`;
  try {
    const conv1 = await createTestConversation(supabase, phone);
    testIds.push(conv1);

    const v1 = await assignVariant(supabase, EXPERIMENT_ID, conv1, {
      customerPhone: phone,
      variants: exp.variants,
      trafficSplit: exp.traffic_split,
    });
    const v2 = await assignVariant(supabase, EXPERIMENT_ID, conv1, {
      customerPhone: phone,
      variants: exp.variants,
      trafficSplit: exp.traffic_split,
    });
    assert(v1 === v2, `assignment persistence failed: ${v1} vs ${v2}`);
    console.log('[test] assignment persistence OK:', v1);

    const distIds: string[] = [];
    for (let i = 0; i < 100; i++) {
      const p = `+5298${String(i).padStart(8, '0')}`;
      const cid = await createTestConversation(supabase, p);
      distIds.push(cid);
      await assignVariant(supabase, EXPERIMENT_ID, cid, {
        customerPhone: p,
        variants: exp.variants,
        trafficSplit: exp.traffic_split,
      });
    }
    testIds.push(...distIds);

    const { data: assigns } = await supabase
      .from('ab_assignments')
      .select('variant')
      .eq('experiment_id', EXPERIMENT_ID)
      .in('conversation_id', distIds);
    const dist: Record<string, number> = {};
    for (const row of assigns ?? []) {
      dist[row.variant] = (dist[row.variant] ?? 0) + 1;
    }
    console.log('[test] assignment distribution 100 leads:', dist);
    for (const v of ['A', 'B', 'C', 'D', 'E']) {
      const n = dist[v] ?? 0;
      assert(n >= 10 && n <= 30, `Assignment ${v} skewed: ${n}/100`);
    }

    const simIds: string[] = [];
    const variants = ['A', 'B', 'C', 'D', 'E'] as const;
    for (const variant of variants) {
      for (let i = 0; i < 40; i++) {
        const p = `+5297${variant}${String(i).padStart(6, '0')}`;
        const cid = await createTestConversation(supabase, p);
        simIds.push(cid);
        const { data: assignment, error: aErr } = await supabase
          .from('ab_assignments')
          .insert({
            experiment_id: EXPERIMENT_ID,
            conversation_id: cid,
            variant,
          })
          .select('id')
          .single();
        if (aErr) throw aErr;
        const convert = variant === 'C' ? i < 12 : i < 2;
        if (convert) {
          await supabase.from('ab_outcomes').insert({
            assignment_id: assignment.id,
            outcome_type: 'qualified_lead',
          });
        }
      }
    }
    testIds.push(...simIds);

    const results = await getExperimentResults(supabase, EXPERIMENT_ID);
    const c = results.variants.find((v) => v.name === 'C');
    const a = results.variants.find((v) => v.name === 'A');
    assert(Boolean(c), 'variant C missing');
    assert((c?.conversion_rate ?? 0) > (a?.conversion_rate ?? 0), 'C should lead');
    assert(results.leading_variant === 'C', `leading should be C, got ${results.leading_variant}`);
    console.log('[test] results leading:', results.leading_variant, 'C rate:', c?.conversion_rate);
    console.log('[test] p vs baseline:', results.p_value_vs_baseline);
  } finally {
    await cleanupConversations(supabase, testIds);
  }

  console.log('[test] ALL PASSED');
}

void main().catch((err) => {
  console.error('[test] FAILED', err);
  process.exit(1);
});
