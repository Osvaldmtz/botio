#!/usr/bin/env node
/**
 * Verifica separación embajadores vs pipeline de venta.
 */

import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: join(root, '.env.local') });

const KALYO_BOT_ID = process.env.KALYO_BOT_ID ?? '64f6eed2-1522-48fe-a2c6-f858b767df06';
const BASE = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'https://botio.dgx.agency';

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function pass(msg) {
  console.log(`✓ ${msg}`);
}

function randomPhone() {
  const suffix = randomBytes(4).toString('hex');
  return `+52999${suffix}`;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminPassword = process.env.ADMIN_PASSWORD;

if (!supabaseUrl || !supabaseKey) {
  fail('Missing Supabase env vars');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let ambassadorConvId = null;
let salesConvId = null;
const ambassadorPhone = randomPhone();
const salesPhone = randomPhone();

async function adminFetch(path) {
  const headers = {};
  if (adminPassword) {
    headers.Cookie = `admin_session=${adminPassword}`;
  }
  const res = await fetch(`${BASE}${path}`, { headers });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

try {
  console.log('Ambassador separation tests\n');

  const { data: ambassadorConv, error: ambErr } = await supabase
    .from('conversations')
    .insert({
      bot_id: KALYO_BOT_ID,
      customer_phone: ambassadorPhone,
      channel: 'whatsapp',
      is_ambassador: true,
      metadata: { is_ambassador_lead: true, customer_name: 'Test Embajador' },
      lead_intent: 'Embajadores',
    })
    .select('id')
    .single();

  if (ambErr || !ambassadorConv) fail(`Create ambassador conv: ${ambErr?.message}`);
  ambassadorConvId = ambassadorConv.id;
  pass(`Created ambassador conv ${ambassadorConvId}`);

  const { data: salesConv, error: salesErr } = await supabase
    .from('conversations')
    .insert({
      bot_id: KALYO_BOT_ID,
      customer_phone: salesPhone,
      channel: 'whatsapp',
      is_ambassador: false,
      lead_score: 45,
      lead_temperature: 'warm',
      metadata: { customer_name: 'Test Cliente' },
    })
    .select('id')
    .single();

  if (salesErr || !salesConv) fail(`Create sales conv: ${salesErr?.message}`);
  salesConvId = salesConv.id;
  pass(`Created sales conv ${salesConvId}`);

  await supabase.from('messages').insert([
    {
      conversation_id: ambassadorConvId,
      role: 'user',
      content: 'Hola programa de embajadores',
      source: 'text',
    },
    {
      conversation_id: salesConvId,
      role: 'user',
      content: 'Hola quiero Kalyo',
      source: 'text',
    },
  ]);

  const metrics = await adminFetch('/api/admin/metrics');
  if (metrics.status === 401) {
    console.log('⚠ Skipping API tests (no admin session) — DB checks only');
  } else if (metrics.status !== 200) {
    fail(`Metrics API ${metrics.status}`);
  } else {
    pass('Metrics API OK');
  }

  const { data: allConvs } = await supabase
    .from('conversations')
    .select('id, is_ambassador')
    .in('id', [ambassadorConvId, salesConvId]);

  const amb = allConvs?.find((c) => c.id === ambassadorConvId);
  const sale = allConvs?.find((c) => c.id === salesConvId);
  if (!amb?.is_ambassador) fail('Ambassador flag not set');
  if (sale?.is_ambassador) fail('Sales conv wrongly marked ambassador');
  pass('is_ambassador flags correct');

  const { data: ambassadorRows } = await supabase
    .from('conversations')
    .select('id')
    .eq('is_ambassador', true)
    .in('id', [ambassadorConvId, salesConvId]);

  if ((ambassadorRows ?? []).length !== 1) {
    fail('Ambassador query should return exactly test ambassador');
  }
  pass('Ambassador-only query returns 1 row');

  const { data: salesRows } = await supabase
    .from('conversations')
    .select('id')
    .or('is_ambassador.is.null,is_ambassador.eq.false')
    .in('id', [ambassadorConvId, salesConvId]);

  if ((salesRows ?? []).length !== 1 || salesRows?.[0]?.id !== salesConvId) {
    fail('Sales filter should exclude ambassador');
  }
  pass('Sales-only filter excludes ambassador');

  if (metrics.status === 200) {
    const ambassadorsApi = await adminFetch('/api/admin/ambassadors');
    if (ambassadorsApi.status !== 200) fail(`Ambassadors API ${ambassadorsApi.status}`);
    const ids = (ambassadorsApi.json.rows ?? []).map((r) => r.id);
    if (!ids.includes(ambassadorConvId)) fail('Ambassador missing from /api/admin/ambassadors');
    if (ids.includes(salesConvId)) fail('Sales conv in ambassadors API');
    pass('/api/admin/ambassadors separation OK');

    const convApi = await adminFetch('/api/admin/conversations');
    if (convApi.status !== 200) fail(`Conversations API ${convApi.status}`);
    const convIds = (convApi.json.conversations ?? []).map((c) => c.id);
    if (convIds.includes(ambassadorConvId)) fail('Ambassador in default conversations list');
    pass('Default conversations excludes ambassadors');

    const pipelineApi = await adminFetch('/api/admin/pipeline');
    if (pipelineApi.status !== 200) fail(`Pipeline API ${pipelineApi.status}`);
    const pipeIds = (pipelineApi.json.leads ?? []).map((l) => l.id);
    if (pipeIds.includes(ambassadorConvId)) fail('Ambassador in pipeline');
    pass('Pipeline excludes ambassadors');
  }

  console.log('\n✓ All ambassador separation tests passed');
} finally {
  for (const id of [ambassadorConvId, salesConvId].filter(Boolean)) {
    await supabase.from('messages').delete().eq('conversation_id', id);
    await supabase.from('ab_assignments').delete().eq('conversation_id', id);
    await supabase.from('conversations').delete().eq('id', id);
  }
  console.log('Cleanup done');
}
