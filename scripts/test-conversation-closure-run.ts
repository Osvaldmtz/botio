import { dirname, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { resolvePipelineStageOnClosure } from '../lib/pipeline-stages';
import type { ClosureReason } from '../lib/conversation-closure-constants';

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
const botId = process.env.KALYO_BOT_ID ?? '64f6eed2-1522-48fe-a2c6-f858b767df06';
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

if (!url || !key) {
  console.error('Missing Supabase env');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const testPhone = `+5299903${String(Date.now()).slice(-5)}`;
let conversationId = '';
const sentTelegram: string[] = [];

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const target = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (target.includes('api.telegram.org') && init?.body) {
    try {
      const body = JSON.parse(String(init.body)) as { text?: string };
      if (body.text) sentTelegram.push(body.text);
    } catch {
      // ignore
    }
  }
  return originalFetch(input, init);
};

async function movePipelineStage(
  client: SupabaseClient,
  conversationId: string,
  fromStage: string | null,
  toStage: string,
): Promise<void> {
  const now = new Date().toISOString();
  await client
    .from('conversations')
    .update({
      pipeline_stage: toStage,
      pipeline_stage_updated_at: now,
      pipeline_stage_updated_by: 'admin',
    })
    .eq('id', conversationId);
  await client.from('pipeline_stage_history').insert({
    conversation_id: conversationId,
    from_stage: fromStage,
    to_stage: toStage,
    moved_by: 'admin',
    reason: 'manual',
  });
}

async function closeConversation(
  client: SupabaseClient,
  id: string,
  reason: ClosureReason,
  note?: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { data: existing } = await client
    .from('conversations')
    .select('pipeline_stage, customer_phone')
    .eq('id', id)
    .single();

  await client
    .from('conversations')
    .update({
      is_closed: true,
      closed_at: now,
      closure_reason: reason,
      closure_note: note ?? null,
      closed_by: 'admin',
    })
    .eq('id', id);

  const targetStage = resolvePipelineStageOnClosure(reason);
  if (targetStage && existing) {
    await movePipelineStage(client, id, existing.pipeline_stage as string, targetStage);
  }

  if (reason === 'converted' && existing && telegramToken && telegramChatId) {
    await originalFetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: `🎉 <b>Conversión confirmada</b>\n\nCliente: ${existing.customer_phone}`,
        parse_mode: 'HTML',
      }),
    });
  }
}

async function reopenConversation(client: SupabaseClient, id: string): Promise<void> {
  await client
    .from('conversations')
    .update({
      is_closed: false,
      closed_at: null,
      closure_reason: null,
      closure_note: null,
      closed_by: null,
      close_reason: null,
    })
    .eq('id', id);
}

async function cleanup(): Promise<void> {
  const { data: convs } = await supabase
    .from('conversations')
    .select('id')
    .eq('customer_phone', testPhone);
  const ids = (convs ?? []).map((c) => c.id);
  if (ids.length) {
    await supabase.from('pipeline_stage_history').delete().in('conversation_id', ids);
    await supabase.from('messages').delete().in('conversation_id', ids);
    await supabase.from('conversations').delete().in('id', ids);
  }
}

async function ensureConversation(): Promise<string> {
  const { data, error } = await supabase
    .from('conversations')
    .upsert(
      {
        bot_id: botId,
        customer_phone: testPhone,
        channel: 'whatsapp',
        pipeline_stage: 'new',
      },
      { onConflict: 'bot_id,customer_phone' },
    )
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('conversation failed');
  return data.id as string;
}

async function fetchConversation(id: string) {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, closed_at, closure_reason, closure_note, closed_by, pipeline_stage')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data!;
}

async function main(): Promise<void> {
  console.log('[test] conversation closure E2E');
  await cleanup();

  conversationId = await ensureConversation();
  console.log(`[test] created conversation ${conversationId}`);

  await closeConversation(supabase, conversationId, 'price', 'Test price objection');

  let conv = await fetchConversation(conversationId);
  assert(Boolean(conv.closed_at), 'closed_at should be set after close');
  assert(conv.closure_reason === 'price', 'closure_reason should be price');
  assert(conv.closed_by === 'admin', 'closed_by should be admin');
  console.log('[test] close with price OK');

  await reopenConversation(supabase, conversationId);
  conv = await fetchConversation(conversationId);
  assert(conv.closed_at === null, 'closed_at should be null after reopen');
  assert(conv.closure_reason === null, 'closure_reason should be null after reopen');
  console.log('[test] reopen OK');

  await closeConversation(supabase, conversationId, 'converted', 'Test conversion');
  conv = await fetchConversation(conversationId);
  assert(conv.closure_reason === 'converted', 'closure_reason should be converted');
  assert(conv.pipeline_stage === 'paid', 'pipeline should move to paid on converted');
  console.log('[test] close with converted + pipeline move OK');

  if (telegramToken && telegramChatId) {
    assert(
      sentTelegram.some((t) => t.includes('Conversión confirmada')),
      'Telegram conversion notification should be sent',
    );
    console.log('[test] telegram notification OK');
  } else {
    console.log('[test] telegram skipped (no env)');
  }

  await closeConversation(supabase, conversationId, 'no_response');
  conv = await fetchConversation(conversationId);
  assert(conv.pipeline_stage === 'lost', 'pipeline should move to lost on no_response');
  console.log('[test] close with no_response + pipeline lost OK');

  await cleanup();
  console.log('[test] cleanup OK');
  console.log('[test] ALL PASSED');
}

main().catch((err) => {
  console.error('[test] FAILED', err);
  void cleanup().finally(() => process.exit(1));
});
