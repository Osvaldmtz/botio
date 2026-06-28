import { dirname, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  groupConversationsByOutcome,
  parseInsightsJson,
  runLearningAnalysis,
  type AnalysisConversation,
  type LearningInsightsPayload,
} from '../lib/learning-analysis';
import { fetchLearningInsights } from '../lib/learning-queries';

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

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const runId = String(Date.now()).slice(-6);
const botId = '64f6eed2-1522-48fe-a2c6-f858b767df06';
const createdConvIds: string[] = [];
const createdInsightIds: string[] = [];

const MOCK_INSIGHTS: LearningInsightsPayload = {
  summary: 'Test semanal — patrones simulados',
  won_patterns: ['Respuesta rápida a objeción de precio'],
  lost_patterns: ['Abandonó tras demo no confirmada'],
  objection_analysis: {
    common_objections: ['precio', 'tiempo'],
    effective_responses: ['ROI con pacientes extra'],
  },
  variant_comparison: { notes: 'Variante C mejor en trials', variants: { C: 2, D: 1 } },
  actionable_insights: [
    {
      priority: 'high',
      insight: 'Confirmar demo en primer intercambio',
      suggested_change: 'Agregar CTA demo más temprano',
    },
    {
      priority: 'medium',
      insight: 'Precio antes de trial',
      suggested_change: 'Mencionar plan Starter antes de activar',
    },
    {
      priority: 'low',
      insight: 'Follow-up 24h',
      suggested_change: 'Recordatorio automático día 2',
    },
  ],
};

async function createMockConversation(
  client: SupabaseClient,
  phone: string,
  outcome: string,
  index: number,
): Promise<string> {
  const now = new Date();
  const outcomeDate = new Date(now.getTime() - index * 3600000).toISOString();
  const createdAt = new Date(now.getTime() - (index + 24) * 3600000).toISOString();

  const { data, error } = await client
    .from('conversations')
    .insert({
      customer_phone: phone,
      bot_id: botId,
      outcome,
      outcome_date: outcomeDate,
      outcome_source: 'learning_test',
      created_at: createdAt,
      last_message_at: outcomeDate,
      lead_score: 40 + index,
      lead_temperature: index % 2 === 0 ? 'warm' : 'cold',
      pipeline_stage: outcome.startsWith('lost_') ? 'lost' : 'trial',
      metadata: { ab_variant: index % 3 === 0 ? 'C' : 'D', customer_email: `${phone}@test.local` },
      is_ambassador: false,
      is_team_member: false,
    })
    .select('id')
    .single();

  if (error || !data) throw error ?? new Error('insert failed');
  const convId = data.id as string;
  createdConvIds.push(convId);

  await client.from('messages').insert([
    {
      conversation_id: convId,
      role: 'user',
      content: `Hola, me interesa Kalyo (${index})`,
      source: 'text',
    },
    {
      conversation_id: convId,
      role: 'assistant',
      content: `¡Hola! Te cuento sobre Kalyo (${index})`,
      source: 'text',
      source_type: 'claude',
    },
  ]);

  return convId;
}

async function cleanup(): Promise<void> {
  if (createdConvIds.length) {
    await supabase.from('messages').delete().in('conversation_id', createdConvIds);
    await supabase.from('conversations').delete().in('id', createdConvIds);
  }
  if (createdInsightIds.length) {
    await supabase.from('learning_insights').delete().in('id', createdInsightIds);
  }
}

async function testSkipBelowMinimum(): Promise<void> {
  const periodEnd = new Date().toISOString();
  const periodStart = new Date(Date.now() - 7 * 24 * 3600000).toISOString();

  const result = await runLearningAnalysis(supabase, {
    periodStart,
    periodEnd,
    minConversations: 99999,
    skipTelegram: true,
    analyzeFn: async () => MOCK_INSIGHTS,
  });

  assert(result.status === 'skipped', 'should skip when below minimum');
  console.log('✓ Skip when insufficient conversations');
}

async function testGrouping(): Promise<void> {
  const convs: AnalysisConversation[] = [
    {
      id: '1',
      outcome: 'paid',
      outcome_date: new Date().toISOString(),
      lead_score: 80,
      lead_temperature: 'hot',
      pipeline_stage: 'paid',
      ab_variant: 'C',
      metadata: {},
      messages: [],
      hours_to_outcome: 12,
    },
    {
      id: '2',
      outcome: 'lost_no_response',
      outcome_date: new Date().toISOString(),
      lead_score: 20,
      lead_temperature: 'cold',
      pipeline_stage: 'lost',
      ab_variant: 'D',
      metadata: {},
      messages: [],
      hours_to_outcome: 48,
    },
  ];

  const groups = groupConversationsByOutcome(convs);
  assert(groups.won.length === 1, 'one won');
  assert(groups.lost.length === 1, 'one lost');
  console.log('✓ Outcome grouping');
}

async function testParseJson(): Promise<void> {
  const raw = `Here is the analysis:\n${JSON.stringify(MOCK_INSIGHTS)}`;
  const parsed = parseInsightsJson(raw);
  assert(parsed.actionable_insights.length === 3, 'three actionable insights');
  console.log('✓ JSON parse structure');
}

async function testFullAnalysisRun(): Promise<void> {
  const phoneBase = `+5299910${runId}`;
  const outcomes = [
    'paid',
    'trial_activated',
    'trial_activated',
    'paid',
    'lost_no_response',
    'lost_objection',
    'lost_price',
    'lost_competitor',
    'unsubscribed',
    'trial_activated',
  ];

  for (let i = 0; i < outcomes.length; i++) {
    await createMockConversation(supabase, `${phoneBase}${i}`, outcomes[i]!, i);
  }

  const telegramMessages: string[] = [];
  const periodEnd = new Date().toISOString();
  const periodStart = new Date(Date.now() - 24 * 3600000).toISOString();

  const result = await runLearningAnalysis(supabase, {
    periodStart,
    periodEnd,
    minConversations: 10,
    skipTelegram: false,
    analyzeFn: async () => MOCK_INSIGHTS,
    sendTelegramFn: async (text) => {
      telegramMessages.push(text);
      return { sent: true };
    },
  });

  assert(result.status === 'ok', 'analysis should succeed');
  if (result.status === 'ok') {
    createdInsightIds.push(result.insight_id);

    const { data: row } = await supabase
      .from('learning_insights')
      .select('insights, total_conversations')
      .eq('id', result.insight_id)
      .single();

    assert(row != null, 'insight row exists');
    const insights = row?.insights as LearningInsightsPayload;
    assert(Array.isArray(insights.actionable_insights), 'insights JSON valid');
    assert((row?.total_conversations ?? 0) >= 10, 'total conversations recorded');

    const listed = await fetchLearningInsights(supabase, { limit: 5 });
    assert(listed.some((r) => r.id === result.insight_id), 'UI query finds new insight');
  }

  assert(telegramMessages.length === 1, 'telegram alert sent');
  const tg = telegramMessages[0]!;
  assert(tg.includes('Top 3 insights'), 'telegram has insights header');
  assert(tg.includes('Confirmar demo'), 'telegram includes top insight');

  console.log('✓ Full analysis run with insight row and telegram');
}

async function runTests(): Promise<void> {
  console.log('Learning analysis tests\n');
  await cleanup();

  await testGrouping();
  await testParseJson();
  await testSkipBelowMinimum();
  await testFullAnalysisRun();

  await cleanup();
  console.log('\nAll learning analysis tests passed.');
}

runTests().catch(async (err) => {
  console.error(err);
  await cleanup().catch(() => undefined);
  process.exit(1);
});
