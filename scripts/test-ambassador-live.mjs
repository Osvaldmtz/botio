#!/usr/bin/env node
/**
 * Simula un lead embajador nuevo contra el webhook de producción y valida el flujo.
 *
 * Uso: node scripts/test-ambassador-live.mjs
 */

import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: join(root, '.env.local') });

const KALYO_BOT_ID = '64f6eed2-1522-48fe-a2c6-f858b767df06';
const WEBHOOK_URL = `https://botio.dgx.agency/api/webhook/${KALYO_BOT_ID}`;
const TWILIO_TO = 'whatsapp:+15559374917';
const TEST_MESSAGE =
  'Hola, soy estudiante de psicología y vi el anuncio sobre el programa de embajadores';
const LUMA_PATH = 'luma.com/eklqji50';

function randomMessageSid() {
  return `SM${randomBytes(16).toString('hex')}`;
}

function randomTestPhone() {
  const suffix = String(Date.now()).slice(-7);
  return `+5299900${suffix}`;
}

function fail(msg) {
  console.error(`\n✗ FAIL: ${msg}`);
  process.exit(1);
}

function pass(msg) {
  console.log(`✓ ${msg}`);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  fail('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const testPhone = randomTestPhone();
let conversationId = null;

console.log('Ambassador live test (prod webhook)');
console.log(`Phone:   ${testPhone}`);
console.log(`Webhook: ${WEBHOOK_URL}`);

try {
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('customer_phone', testPhone)
    .maybeSingle();

  if (existing) {
    fail(`Phone ${testPhone} already has a conversation`);
  }

  const body = new URLSearchParams({
    From: `whatsapp:${testPhone}`,
    To: TWILIO_TO,
    Body: TEST_MESSAGE,
    MessageSid: randomMessageSid(),
    AccountSid: process.env.TWILIO_ACCOUNT_SID ?? 'ACtest',
    NumMedia: '0',
  });

  console.log('\nSending webhook...');
  const webhookRes = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const webhookText = await webhookRes.text();
  console.log(`Webhook status: ${webhookRes.status}`);
  if (!webhookRes.ok) {
    fail(`Webhook returned ${webhookRes.status}: ${webhookText}`);
  }

  console.log('Waiting 6s for processing...');
  await new Promise((r) => setTimeout(r, 6000));

  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select(
      'id, customer_phone, is_ambassador, lead_score, lead_temperature, lead_signals, metadata, webinar_link_sent_at',
    )
    .eq('customer_phone', testPhone)
    .maybeSingle();

  if (convError) fail(`Conversation query failed: ${convError.message}`);
  if (!conversation) fail('No conversation created');

  conversationId = conversation.id;

  const { data: messages, error: msgError } = await supabase
    .from('messages')
    .select('role, content, metadata')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (msgError) fail(`Messages query failed: ${msgError.message}`);

  const assistantMsg = (messages ?? []).find((m) => m.role === 'assistant');
  if (!assistantMsg) fail('No assistant reply stored');

  const reply = assistantMsg.content ?? '';
  console.log('\n--- Bot reply (preview) ---');
  console.log(reply.slice(0, 400));
  console.log('---\n');

  if (!reply.toLowerCase().includes(LUMA_PATH)) {
    fail(`Reply missing Luma link (${LUMA_PATH})`);
  }
  pass(`Reply includes ${LUMA_PATH}`);

  const forbidden = ['demo', 'trial', 'osvaldo'];
  for (const word of forbidden) {
    if (reply.toLowerCase().includes(word)) {
      fail(`Reply contains forbidden word "${word}"`);
    }
  }
  pass('Reply does NOT contain demo / trial / Osvaldo');

  if (!conversation.is_ambassador) {
    fail(`is_ambassador=false (metadata=${JSON.stringify(conversation.metadata)})`);
  }
  pass('Conversation has is_ambassador=true');

  const metadata = conversation.metadata ?? {};
  if (metadata.is_ambassador_lead !== true) {
    fail('metadata.is_ambassador_lead is not true');
  }
  pass('metadata.is_ambassador_lead=true');

  const score = conversation.lead_score ?? 0;
  if (score >= 70) {
    fail(`HOT lead score detected: ${score}`);
  }
  pass(`No HOT lead score (score=${conversation.lead_score ?? 'null'})`);

  const signals = Array.isArray(conversation.lead_signals) ? conversation.lead_signals : [];
  const hotAlerts = signals.filter((s) => String(s).startsWith('hot_alert:'));
  if (hotAlerts.length > 0) {
    fail(`HOT alert signals found: ${hotAlerts.join(', ')}`);
  }
  pass('No hot_alert signals in lead_signals');

  const faqId = assistantMsg.metadata?.ambassador_faq_id;
  if (faqId) {
    pass(`Ambassador FAQ used: ${faqId}`);
  }

  console.log('\n✓ All ambassador live tests passed');
} finally {
  if (conversationId) {
    console.log(`\nCleaning up test conversation ${conversationId}...`);
    await supabase.from('messages').delete().eq('conversation_id', conversationId);
    await supabase.from('ab_assignments').delete().eq('conversation_id', conversationId);
    await supabase.from('conversations').delete().eq('id', conversationId);
    console.log('Cleanup done');
  }
}
