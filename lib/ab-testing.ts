import type { SupabaseClient } from '@supabase/supabase-js';
import { isAmbassadorConversation } from '@/lib/ambassador-filters';

export type ExperimentScope = 'first_message' | string;

export type ExperimentVariant = {
  label?: string;
  first_message?: string;
  second_message?: string;
  system_prompt?: string;
  active?: boolean;
  assigned?: number;
  converted?: number;
};

export type Experiment = {
  id: string;
  name: string;
  description: string | null;
  bot_id: string | null;
  scope: ExperimentScope;
  status: string;
  variants: Record<string, ExperimentVariant>;
  traffic_split: Record<string, number>;
  winner_variant: string | null;
  min_sample_size: number;
  created_at: string;
  ended_at: string | null;
};

export type VariantResult = {
  name: string;
  label?: string;
  count: number;
  conversions: number;
  conversion_rate: number;
  trial_conversions: number;
  trial_conversion_rate: number;
};

export type ExperimentResults = {
  experiment_id: string;
  variants: VariantResult[];
  winner?: string;
  leading_variant?: string;
  p_value?: number;
  p_value_vs_baseline?: number;
  baseline_variant?: string;
  sample_ready: boolean;
  conversions_needed?: number;
  statistically_significant?: boolean;
};

export type AbAssignmentContext = {
  experiment_id: string;
  experiment_name: string;
  variant: string;
  scope: ExperimentScope;
  payload: Record<string, unknown>;
};

const LEAD_CONVERSION_OUTCOME = 'qualified_lead';
const TRIAL_CONVERSION_OUTCOME = 'trial_activado';

const VARIANT_F_AFFIRMATIVE_RE =
  /\b(s[ií]|si|dale|quiero|act[ií]valo|activalo|claro|adelante|listo|va|por\s+favor|me\s+interesa|obvio|sale|[aá]ndale|c[oó]mo\s+no)\b/i;

export function isVariantAffirmativeResponse(text: string): boolean {
  return VARIANT_F_AFFIRMATIVE_RE.test(text.trim());
}

function activeVariantKeys(variants: Record<string, ExperimentVariant>): string[] {
  return Object.keys(variants).filter((key) => variants[key]?.active !== false);
}

export function pickVariant(trafficSplit: Record<string, number>): string {
  const entries = Object.entries(trafficSplit).filter(([, w]) => w > 0);
  if (entries.length === 0) return 'A';

  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;

  for (const [variant, weight] of entries) {
    r -= weight;
    if (r <= 0) return variant;
  }

  return entries[entries.length - 1][0];
}

export function uniformTrafficSplit(variantKeys: string[]): Record<string, number> {
  if (variantKeys.length === 0) return { A: 1 };
  const weight = 1 / variantKeys.length;
  return Object.fromEntries(variantKeys.map((key) => [key, weight]));
}

function resolveTrafficSplit(
  variants: Record<string, ExperimentVariant>,
  trafficSplit: Record<string, number> | null | undefined,
): Record<string, number> {
  const keys = activeVariantKeys(variants);
  if (keys.length === 0) return { B: 1 };

  if (!trafficSplit || Object.keys(trafficSplit).length === 0) {
    return uniformTrafficSplit(keys);
  }

  const filtered = Object.fromEntries(
    keys
      .map((key) => [key, Number(trafficSplit[key] ?? 0)] as const)
      .filter(([, w]) => w > 0),
  );
  if (Object.keys(filtered).length === 0) return uniformTrafficSplit(keys);
  return filtered;
}

function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const prob =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.7814779 + t * (-1.821256 + t * 1.3302744))));
  return z > 0 ? 1 - prob : prob;
}

function twoProportionZTest(
  n1: number,
  x1: number,
  n2: number,
  x2: number,
): number | null {
  if (n1 < 2 || n2 < 2) return null;
  const p1 = x1 / n1;
  const p2 = x2 / n2;
  const pPool = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));
  if (se === 0) return null;
  const z = (p1 - p2) / se;
  return 2 * (1 - normalCdf(Math.abs(z)));
}

async function notifyAbWinnerTelegram(params: {
  experimentName: string;
  winner: string;
  winnerLabel?: string;
  conversionRate: number;
  baselineRate: number;
  pValue: number;
}): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) return;

  const label = params.winnerLabel ?? params.winner;
  const text =
    `🏆 <b>A/B test ganador</b>\n\n` +
    `Experimento: ${params.experimentName}\n` +
    `Variante ${params.winner} (${label}) ganó con ${params.conversionRate}% conversión ` +
    `(vs ${params.baselineRate}% baseline, p=${params.pValue})`;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  } catch (error) {
    console.error('[ab-testing] telegram winner notify failed', error);
  }
}

async function findPriorVariantByPhone(
  supabase: SupabaseClient,
  experimentId: string,
  customerPhone: string,
): Promise<string | null> {
  const phone = customerPhone.trim();
  if (!phone) return null;

  const { data, error } = await supabase
    .from('ab_assignments')
    .select('variant, conversations!inner(customer_phone)')
    .eq('experiment_id', experimentId)
    .eq('conversations.customer_phone', phone)
    .order('assigned_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[ab-testing] prior variant lookup failed', error);
    return null;
  }

  return data?.variant ?? null;
}

export async function getActiveExperiments(
  supabase: SupabaseClient,
  botId: string,
  scope: ExperimentScope,
): Promise<Experiment[]> {
  const { data, error } = await supabase
    .from('ab_experiments')
    .select('*')
    .eq('status', 'active')
    .eq('scope', scope)
    .or(`bot_id.eq.${botId},bot_id.is.null`);

  if (error) throw error;
  return (data ?? []) as Experiment[];
}

async function getCompletedWinnerExperiments(
  supabase: SupabaseClient,
  botId: string,
  scope: ExperimentScope,
): Promise<Experiment[]> {
  const { data, error } = await supabase
    .from('ab_experiments')
    .select('*')
    .eq('status', 'completed')
    .eq('scope', scope)
    .not('winner_variant', 'is', null)
    .or(`bot_id.eq.${botId},bot_id.is.null`);

  if (error) throw error;
  return (data ?? []) as Experiment[];
}

export async function assignVariant(
  supabase: SupabaseClient,
  experimentId: string,
  conversationId: string,
  options?: {
    customerPhone?: string;
    forcedVariant?: string;
    trafficSplit?: Record<string, number>;
    variants?: Record<string, ExperimentVariant>;
  },
): Promise<string> {
  const { data: existing } = await supabase
    .from('ab_assignments')
    .select('variant')
    .eq('experiment_id', experimentId)
    .eq('conversation_id', conversationId)
    .maybeSingle();

  if (existing?.variant) return existing.variant;

  if (options?.forcedVariant) {
    const variant = options.forcedVariant;
    const { error: insertError } = await supabase.from('ab_assignments').insert({
      experiment_id: experimentId,
      conversation_id: conversationId,
      variant,
    });
    if (insertError) throw insertError;
    return variant;
  }

  if (options?.customerPhone) {
    const prior = await findPriorVariantByPhone(
      supabase,
      experimentId,
      options.customerPhone,
    );
    if (prior) {
      const { error: insertError } = await supabase.from('ab_assignments').insert({
        experiment_id: experimentId,
        conversation_id: conversationId,
        variant: prior,
      });
      if (insertError) throw insertError;
      console.log(
        `[ab-testing] reused prior variant=${prior} for phone conv=${conversationId}`,
      );
      return prior;
    }
  }

  const { data: experiment, error: expError } = await supabase
    .from('ab_experiments')
    .select('traffic_split, variants')
    .eq('id', experimentId)
    .maybeSingle();

  if (expError || !experiment) throw expError ?? new Error('Experiment not found');

  const variants = (options?.variants ??
    experiment.variants ??
    {}) as Record<string, ExperimentVariant>;
  const split = resolveTrafficSplit(
    variants,
    options?.trafficSplit ?? (experiment.traffic_split as Record<string, number>),
  );
  const variant = pickVariant(split);

  const { error: insertError } = await supabase.from('ab_assignments').insert({
    experiment_id: experimentId,
    conversation_id: conversationId,
    variant,
  });

  if (insertError) throw insertError;

  console.log(
    `[ab-testing] assigned conv=${conversationId} to variant=${variant} in exp=${experimentId}`,
  );

  return variant;
}

async function persistAbMetadata(
  supabase: SupabaseClient,
  conversationId: string,
  contexts: AbAssignmentContext[],
): Promise<void> {
  const first = contexts.find((c) => c.scope === 'first_message');
  if (!first) return;

  const { data: conv } = await supabase
    .from('conversations')
    .select('metadata')
    .eq('id', conversationId)
    .maybeSingle();

  const metadata = {
    ...((conv?.metadata as Record<string, unknown> | null) ?? {}),
    ab_variant: first.variant,
    ab_experiment_id: first.experiment_id,
    ab_experiment_name: first.experiment_name,
  };

  await supabase.from('conversations').update({ metadata }).eq('id', conversationId);
}

export async function ensureConversationAssignments(
  supabase: SupabaseClient,
  botId: string,
  conversationId: string,
  scope: ExperimentScope = 'first_message',
  customerPhone?: string,
): Promise<AbAssignmentContext[]> {
  const { data: convRow } = await supabase
    .from('conversations')
    .select('is_ambassador, is_team_member, metadata')
    .eq('id', conversationId)
    .maybeSingle();

  if (
    convRow?.is_team_member === true ||
    (convRow &&
      isAmbassadorConversation({
        is_ambassador: convRow.is_ambassador,
        metadata: convRow.metadata as Record<string, unknown> | null,
      }))
  ) {
    console.log(`[ab-testing] skip assignment | reason=${convRow?.is_team_member ? 'is_team_member' : 'is_ambassador'} | conv=${conversationId}`);
    return [];
  }

  console.log(`[ab-testing] checking active experiments for bot=${botId} scope=${scope}`);

  const [activeExperiments, winnerExperiments] = await Promise.all([
    getActiveExperiments(supabase, botId, scope),
    getCompletedWinnerExperiments(supabase, botId, scope),
  ]);

  if (activeExperiments.length === 0 && winnerExperiments.length === 0) {
    console.log('[ab-testing] no experiments found');
    return [];
  }

  console.log(
    `[ab-testing] found ${activeExperiments.length} active, ${winnerExperiments.length} completed-with-winner`,
  );
  const contexts: AbAssignmentContext[] = [];

  for (const exp of activeExperiments) {
    const variant = await assignVariant(supabase, exp.id, conversationId, {
      customerPhone,
      variants: exp.variants,
      trafficSplit: exp.traffic_split,
    });
    contexts.push({
      experiment_id: exp.id,
      experiment_name: exp.name,
      variant,
      scope: exp.scope,
      payload: (exp.variants[variant] ?? {}) as Record<string, unknown>,
    });
  }

  for (const exp of winnerExperiments) {
    if (!exp.winner_variant) continue;
    const variant = await assignVariant(supabase, exp.id, conversationId, {
      customerPhone,
      forcedVariant: exp.winner_variant,
    });
    contexts.push({
      experiment_id: exp.id,
      experiment_name: exp.name,
      variant,
      scope: exp.scope,
      payload: (exp.variants[variant] ?? {}) as Record<string, unknown>,
    });
  }

  if (contexts.length > 0) {
    await persistAbMetadata(supabase, conversationId, contexts);
  }

  return contexts;
}

export function getFirstMessageOverride(
  assignments: AbAssignmentContext[],
): string | null {
  for (const ctx of assignments) {
    if (ctx.scope !== 'first_message') continue;
    const msg = ctx.payload.first_message;
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
  }
  return null;
}

export function resolveVariantFSecondMessage(
  variant: string,
  payload: Record<string, unknown>,
  userMessage: string,
  totalUserMsgs: number,
  turn2AlreadySent: boolean,
): string | null {
  if (variant !== 'F') return null;
  if (totalUserMsgs !== 2) return null;
  if (turn2AlreadySent) return null;

  const second = payload.second_message;
  if (typeof second !== 'string' || !second.trim()) return null;
  if (!isVariantAffirmativeResponse(userMessage)) return null;

  return second.trim();
}

export async function loadConversationFirstMessageAssignment(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<AbAssignmentContext | null> {
  const { data, error } = await supabase
    .from('ab_assignments')
    .select('variant, experiment_id, ab_experiments(id, name, scope, variants)')
    .eq('conversation_id', conversationId)
    .order('assigned_at', { ascending: false });

  if (error) {
    console.error('[ab-testing] load assignment failed', error);
    return null;
  }

  for (const row of data ?? []) {
    const exp = row.ab_experiments as {
      id?: string;
      name?: string;
      scope?: string;
      variants?: Record<string, ExperimentVariant>;
    } | null;
    if (!exp?.id || exp.scope !== 'first_message') continue;

    const variant = row.variant;
    const payload = (exp.variants?.[variant] ?? {}) as Record<string, unknown>;
    return {
      experiment_id: exp.id,
      experiment_name: exp.name ?? '',
      variant,
      scope: 'first_message',
      payload,
    };
  }

  return null;
}

export function buildAbSystemPromptSuffix(
  assignments: AbAssignmentContext[],
  isFirstUserMessage: boolean,
): string {
  if (!isFirstUserMessage) return '';

  const parts: string[] = [];
  for (const ctx of assignments) {
    if (ctx.scope !== 'first_message') continue;
    const msg = ctx.payload.first_message;
    if (typeof msg === 'string' && msg.trim()) {
      parts.push(
        `[A/B TEST — Variante ${ctx.variant}] En este PRIMER mensaje responde de forma natural siguiendo esta guía: ${msg.trim()}`,
      );
    }
    const prompt = ctx.payload.system_prompt;
    if (typeof prompt === 'string' && prompt.trim()) {
      parts.push(`[A/B TEST — Variante ${ctx.variant}] ${prompt.trim()}`);
    }
  }

  return parts.length ? `\n\n${parts.join('\n')}` : '';
}

export async function recordOutcome(
  supabase: SupabaseClient,
  conversationId: string,
  outcomeType: string,
  outcomeValue?: Record<string, unknown>,
): Promise<void> {
  const { data: assignments, error } = await supabase
    .from('ab_assignments')
    .select('id, experiment_id, variant')
    .eq('conversation_id', conversationId);

  if (error) {
    console.error('[ab-testing] failed to load assignments', error);
    return;
  }

  for (const assignment of assignments ?? []) {
    const { data: existing } = await supabase
      .from('ab_outcomes')
      .select('id')
      .eq('assignment_id', assignment.id)
      .eq('outcome_type', outcomeType)
      .maybeSingle();

    if (existing) continue;

    const { error: insertError } = await supabase.from('ab_outcomes').insert({
      assignment_id: assignment.id,
      outcome_type: outcomeType,
      outcome_value: outcomeValue ?? null,
    });

    if (insertError) {
      console.error('[ab-testing] outcome insert failed', insertError);
      continue;
    }

    console.log(
      `[ab-testing] outcome recorded | exp=${assignment.experiment_id} | conv=${conversationId} | type=${outcomeType}`,
    );
  }
}

export async function getExperimentResults(
  supabase: SupabaseClient,
  experimentId: string,
): Promise<ExperimentResults> {
  const { data: experiment, error: expError } = await supabase
    .from('ab_experiments')
    .select('min_sample_size, winner_variant, name, variants, status')
    .eq('id', experimentId)
    .maybeSingle();

  if (expError || !experiment) throw expError ?? new Error('Experiment not found');

  const variantDefs = (experiment.variants ?? {}) as Record<string, ExperimentVariant>;

  const { data: assignments, error: assignError } = await supabase
    .from('ab_assignments')
    .select('id, variant')
    .eq('experiment_id', experimentId);

  if (assignError) throw assignError;

  const byVariant = new Map<string, { ids: string[] }>();

  for (const row of assignments ?? []) {
    const bucket = byVariant.get(row.variant) ?? { ids: [] };
    bucket.ids.push(row.id);
    byVariant.set(row.variant, bucket);
  }

  for (const key of Object.keys(variantDefs)) {
    if (!byVariant.has(key)) byVariant.set(key, { ids: [] });
  }

  const assignmentIds = (assignments ?? []).map((a) => a.id);
  const leadConversionByAssignment = new Set<string>();
  const trialConversionByAssignment = new Set<string>();

  if (assignmentIds.length > 0) {
    const { data: outcomes } = await supabase
      .from('ab_outcomes')
      .select('assignment_id, outcome_type')
      .in('assignment_id', assignmentIds)
      .in('outcome_type', [LEAD_CONVERSION_OUTCOME, TRIAL_CONVERSION_OUTCOME]);

    for (const o of outcomes ?? []) {
      if (o.outcome_type === LEAD_CONVERSION_OUTCOME) {
        leadConversionByAssignment.add(o.assignment_id);
      }
      if (o.outcome_type === TRIAL_CONVERSION_OUTCOME) {
        trialConversionByAssignment.add(o.assignment_id);
      }
    }
  }

  const variants: VariantResult[] = [];
  for (const [name, bucket] of Array.from(byVariant.entries())) {
    const conversions = bucket.ids.filter((id) => leadConversionByAssignment.has(id)).length;
    const trialConversions = bucket.ids.filter((id) =>
      trialConversionByAssignment.has(id),
    ).length;
    variants.push({
      name,
      label: variantDefs[name]?.label,
      count: bucket.ids.length,
      conversions,
      conversion_rate:
        bucket.ids.length > 0
          ? Math.round((conversions / bucket.ids.length) * 10000) / 100
          : 0,
      trial_conversions: trialConversions,
      trial_conversion_rate:
        bucket.ids.length > 0
          ? Math.round((trialConversions / bucket.ids.length) * 10000) / 100
          : 0,
    });
  }

  variants.sort((a, b) => a.name.localeCompare(b.name));

  const minConversions = experiment.min_sample_size ?? 30;
  const sample_ready =
    variants.length >= 2 && variants.every((v) => v.conversions >= minConversions);

  const maxConversions = Math.max(...variants.map((v) => v.conversions), 0);
  const conversions_needed = sample_ready
    ? 0
    : Math.max(0, minConversions - maxConversions);

  let p_value: number | undefined;
  let p_value_vs_baseline: number | undefined;
  let winner: string | undefined = experiment.winner_variant ?? undefined;
  let leading_variant: string | undefined;
  let statistically_significant = false;

  if (variants.length >= 2) {
    const sorted = [...variants].sort((a, b) => b.conversion_rate - a.conversion_rate);
    leading_variant = sorted[0]?.name;
    const top = sorted[0];
    const second = sorted[1];
    const baseline =
      variants.find((v) => v.name === 'A') ?? sorted[sorted.length - 1];

    const pTopSecond = twoProportionZTest(
      top.count,
      top.conversions,
      second.count,
      second.conversions,
    );
    if (pTopSecond !== null) p_value = Math.round(pTopSecond * 10000) / 10000;

    const pVsBaseline = twoProportionZTest(
      top.count,
      top.conversions,
      baseline.count,
      baseline.conversions,
    );
    if (pVsBaseline !== null) {
      p_value_vs_baseline = Math.round(pVsBaseline * 10000) / 10000;
      statistically_significant = p_value_vs_baseline < 0.05;
    }

    if (sample_ready && p_value !== undefined && p_value < 0.05) {
      winner = top.name;
      if (!experiment.winner_variant && experiment.status === 'active') {
        const now = new Date().toISOString();
        await supabase
          .from('ab_experiments')
          .update({
            winner_variant: winner,
            status: 'completed',
            ended_at: now,
          })
          .eq('id', experimentId);

        await notifyAbWinnerTelegram({
          experimentName: experiment.name,
          winner: top.name,
          winnerLabel: top.label,
          conversionRate: top.conversion_rate,
          baselineRate: baseline.conversion_rate,
          pValue: p_value_vs_baseline ?? p_value,
        });

        console.log(
          `[ab-testing] winner promoted | exp=${experimentId} | winner=${winner} | p_value=${p_value}`,
        );
      }
    }
  }

  return {
    experiment_id: experimentId,
    variants,
    winner,
    leading_variant,
    p_value,
    p_value_vs_baseline,
    baseline_variant: 'A',
    sample_ready,
    conversions_needed,
    statistically_significant,
  };
}

export type OutcomeBreakdown = {
  variant: string;
  outcomes: Record<string, number>;
};

export async function getExperimentOutcomeBreakdown(
  supabase: SupabaseClient,
  experimentId: string,
): Promise<OutcomeBreakdown[]> {
  const { data: assignments, error } = await supabase
    .from('ab_assignments')
    .select('id, variant')
    .eq('experiment_id', experimentId);

  if (error) throw error;

  const byVariant = new Map<string, string[]>();
  for (const row of assignments ?? []) {
    const ids = byVariant.get(row.variant) ?? [];
    ids.push(row.id);
    byVariant.set(row.variant, ids);
  }

  const allIds = (assignments ?? []).map((a) => a.id);
  const outcomesByAssignment = new Map<string, string[]>();

  if (allIds.length > 0) {
    const { data: outcomes } = await supabase
      .from('ab_outcomes')
      .select('assignment_id, outcome_type')
      .in('assignment_id', allIds);

    for (const o of outcomes ?? []) {
      const list = outcomesByAssignment.get(o.assignment_id) ?? [];
      list.push(o.outcome_type);
      outcomesByAssignment.set(o.assignment_id, list);
    }
  }

  const breakdown: OutcomeBreakdown[] = [];
  for (const [variant, ids] of Array.from(byVariant.entries())) {
    const counts: Record<string, number> = {};
    for (const id of ids) {
      for (const type of outcomesByAssignment.get(id) ?? []) {
        counts[type] = (counts[type] ?? 0) + 1;
      }
    }
    breakdown.push({ variant, outcomes: counts });
  }

  breakdown.sort((a, b) => a.variant.localeCompare(b.variant));
  return breakdown;
}

export async function listExperiments(supabase: SupabaseClient): Promise<Experiment[]> {
  const { data, error } = await supabase
    .from('ab_experiments')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Experiment[];
}
