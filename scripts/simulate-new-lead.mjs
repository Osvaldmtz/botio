#!/usr/bin/env node
/**
 * Simula un mensaje entrante de WhatsApp desde un número nuevo
 * para validar asignación A/B end-to-end.
 *
 * Uso:
 *   node scripts/simulate-new-lead.mjs
 *   node scripts/simulate-new-lead.mjs +528123456789 "Hola"
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

const phoneArg = process.argv[2] ?? '+528123456789';
const messageArg = process.argv[3] ?? 'Hola, quiero conocer Kalyo';

function normalizePhone(phone) {
  const stripped = phone.trim().replace(/^whatsapp:/i, '');
  if (!stripped) return undefined;
  if (stripped.startsWith('+521') && stripped.length === 14) {
    return `+52${stripped.slice(4)}`;
  }
  return stripped;
}

function randomMessageSid() {
  return `SM${randomBytes(16).toString('hex')}`;
}

function section(title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(title);
  console.log('='.repeat(60));
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const normalizedPhone = normalizePhone(phoneArg);
if (!normalizedPhone) {
  console.error(`Número inválido: ${phoneArg}`);
  process.exit(1);
}

section('Simulación de lead nuevo — Botio A/B');
console.log(`Teléfono:     ${normalizedPhone}`);
console.log(`Mensaje:      ${messageArg}`);
console.log(`Webhook:      ${WEBHOOK_URL}`);

const { data: existing, error: existingError } = await supabase
  .from('conversations')
  .select('id, customer_phone, created_at')
  .eq('customer_phone', normalizedPhone)
  .maybeSingle();

if (existingError) {
  console.error('Error consultando conversations:', existingError.message);
  process.exit(1);
}

if (existing) {
  console.error(
    `\nABORT: ya existe una conversación para ${normalizedPhone} (id=${existing.id}, created_at=${existing.created_at}).`,
  );
  console.error('Usa otro número, por ejemplo:');
  console.error(`  node scripts/simulate-new-lead.mjs +5299900${String(Date.now()).slice(-5)}`);
  process.exit(1);
}

console.log('\n✓ Número libre — enviando webhook Twilio...');

const body = new URLSearchParams({
  From: `whatsapp:${normalizedPhone}`,
  To: TWILIO_TO,
  Body: messageArg,
  MessageSid: randomMessageSid(),
  AccountSid: process.env.TWILIO_ACCOUNT_SID ?? 'ACtest',
  NumMedia: '0',
});

const webhookRes = await fetch(WEBHOOK_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: body.toString(),
});

const webhookText = await webhookRes.text();

section('Respuesta del webhook');
console.log(`Status: ${webhookRes.status} ${webhookRes.statusText}`);
console.log('Body:');
console.log(webhookText || '(vacío)');

console.log('\nEsperando 5s para que procese la respuesta de Claude...');
await new Promise((resolve) => setTimeout(resolve, 5000));

const { data: conversation, error: convError } = await supabase
  .from('conversations')
  .select('id, customer_phone, channel, pipeline_stage, created_at, last_message_at')
  .eq('customer_phone', normalizedPhone)
  .maybeSingle();

if (convError) {
  console.error('Error consultando conversación:', convError.message);
  process.exit(1);
}

if (!conversation) {
  console.error('\nERROR: no se creó ninguna conversación después del webhook.');
  process.exit(1);
}

const { data: assignments, error: assignError } = await supabase
  .from('ab_assignments')
  .select('variant, assigned_at, experiment_id')
  .eq('conversation_id', conversation.id);

if (assignError) {
  console.error('Error consultando ab_assignments:', assignError.message);
  process.exit(1);
}

const experimentIds = [...new Set((assignments ?? []).map((a) => a.experiment_id))];
let experimentsById = new Map();

if (experimentIds.length > 0) {
  const { data: experiments, error: expError } = await supabase
    .from('ab_experiments')
    .select('id, name')
    .in('id', experimentIds);

  if (expError) {
    console.error('Error consultando ab_experiments:', expError.message);
    process.exit(1);
  }

  experimentsById = new Map((experiments ?? []).map((e) => [e.id, e.name]));
}

const { data: messages, error: msgError } = await supabase
  .from('messages')
  .select('role, source_type, content, created_at')
  .eq('conversation_id', conversation.id)
  .order('created_at', { ascending: true });

if (msgError) {
  console.error('Error consultando messages:', msgError.message);
  process.exit(1);
}

section('a) Conversación creada');
console.log(JSON.stringify(conversation, null, 2));

section('b) Asignación A/B');
if (!assignments?.length) {
  console.log('(sin asignaciones)');
} else {
  for (const row of assignments) {
    console.log(
      JSON.stringify(
        {
          variant: row.variant,
          assigned_at: row.assigned_at,
          experiment: experimentsById.get(row.experiment_id) ?? row.experiment_id,
        },
        null,
        2,
      ),
    );
  }
}

section('c) Mensajes generados');
if (!messages?.length) {
  console.log('(sin mensajes)');
} else {
  for (const msg of messages) {
    const preview =
      msg.content.length > 200 ? `${msg.content.slice(0, 200)}…` : msg.content;
    console.log(
      JSON.stringify(
        {
          role: msg.role,
          source_type: msg.source_type,
          content: preview,
          created_at: msg.created_at,
        },
        null,
        2,
      ),
    );
    console.log('---');
  }
}

section('Resumen');
const variant = assignments?.[0]?.variant ?? '—';
const experimentName =
  assignments?.[0]?.experiment_id != null
    ? experimentsById.get(assignments[0].experiment_id) ?? '—'
    : '—';
const assistantMsg = (messages ?? []).find((m) => m.role === 'assistant');

console.log(`Conversación:  ${conversation.id}`);
console.log(`Teléfono:      ${conversation.customer_phone}`);
console.log(`Pipeline:      ${conversation.pipeline_stage}`);
console.log(`Variante A/B:  ${variant}`);
console.log(`Experimento:   ${experimentName}`);
console.log(
  `Respuesta bot: ${assistantMsg ? `${assistantMsg.content.slice(0, 120)}${assistantMsg.content.length > 120 ? '…' : ''}` : '(ninguna)'}`,
);
console.log(`A/B asignado:  ${assignments?.length ? 'SÍ ✓' : 'NO ✗'}`);
