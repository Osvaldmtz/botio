import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export type ExperimentScope = 'first_message' | string;

export type Experiment = {
  id: string;
  name: string;
  description: string | null;
  bot_id: string | null;
  scope: ExperimentScope;
  status: string;
  variants: Record<string, Record<string, unknown>>;
  traffic_split: Record<string, number>;
  winner_variant: string | null;
  min_sample_size: number;
  created_at: string;
  ended_at: string | null;
};

export type VariantResult = {
  name: string;
  count: number;
  conversions: number;
  conversion_rate: number;
};

export type ExperimentResults = {
  experiment_id: string;
  variants: VariantResult[];
  winner?: string;
  p_value?: number;
  sample_ready: boolean;
};

export type AbAssignmentContext = {
  experiment_id: string;
  experiment_name: string;
  variant: string;
  scope: ExperimentScope;
  payload: Record<string, unknown>;
};

const CONVERSION_OUTCOMES = new Set([
  'lead_captured',
  'trial_activated',
  'purchase',
  'purchase_intent',
]);

function pickVariant(trafficSplit: Record<string, number>): string {
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

export async function assignVariant(
  supabase: SupabaseClient,
  experimentId: string,
  conversationId: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from('ab_assignments')
    .select('variant')
    .eq('experiment_id', experimentId)
    .eq('conversation_id', conversationId)
    .maybeSingle();

  if (existing?.variant) return existing.variant;

  const { data: experiment, error: expError } = await supabase
    .from('ab_experiments')
    .select('traffic_split')
    .eq('id', experimentId)
    .maybeSingle();

  if (expError || !experiment) throw expError ?? new Error('Experiment not found');

  const split = (experiment.traffic_split ?? { A: 0.5, B: 0.5 }) as Record<
    string,
    number
  >;
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

export async function ensureConversationAssignments(
  supabase: SupabaseClient,
  botId: string,
  conversationId: string,
  scope: ExperimentScope = 'first_message',
): Promise<AbAssignmentContext[]> {
  console.log(`[ab-testing] checking active experiments for bot=${botId} scope=${scope}`);

  const experiments = await getActiveExperiments(supabase, botId, scope);
  if (experiments.length === 0) {
    console.log('[ab-testing] no active experiments found');
    return [];
  }

  console.log(`[ab-testing] found ${experiments.length} experiments`);
  const contexts: AbAssignmentContext[] = [];

  for (const exp of experiments) {
    const variant = await assignVariant(supabase, exp.id, conversationId);
    const variants = exp.variants ?? {};
    contexts.push({
      experiment_id: exp.id,
      experiment_name: exp.name,
      variant,
      scope: exp.scope,
      payload: (variants[variant] ?? {}) as Record<string, unknown>,
    });
  }

  return contexts;
}

export function getFirstMessageOverride(
  assignments: AbAssignmentContext[],
): string | null {
  for (const ctx of assignments) {
    if (ctx.scope !== 'first_message') continue;
    if (ctx.variant === 'A') continue;
    const msg = ctx.payload.first_message;
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
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
    if (ctx.variant === 'A') {
      parts.push(
        `[A/B TEST — Variante A (control)] Usa el flujo y tono estándar de Kalyo para el primer mensaje.`,
      );
      continue;
    }
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
    .select('min_sample_size, winner_variant')
    .eq('id', experimentId)
    .maybeSingle();

  if (expError || !experiment) throw expError ?? new Error('Experiment not found');

  const { data: assignments, error: assignError } = await supabase
    .from('ab_assignments')
    .select('id, variant')
    .eq('experiment_id', experimentId);

  if (assignError) throw assignError;

  const byVariant = new Map<string, { ids: string[]; conversions: number }>();

  for (const row of assignments ?? []) {
    const bucket = byVariant.get(row.variant) ?? { ids: [], conversions: 0 };
    bucket.ids.push(row.id);
    byVariant.set(row.variant, bucket);
  }

  const assignmentIds = (assignments ?? []).map((a) => a.id);
  const conversionByAssignment = new Set<string>();

  if (assignmentIds.length > 0) {
    const { data: outcomes } = await supabase
      .from('ab_outcomes')
      .select('assignment_id, outcome_type')
      .in('assignment_id', assignmentIds)
      .in('outcome_type', Array.from(CONVERSION_OUTCOMES));

    for (const o of outcomes ?? []) {
      conversionByAssignment.add(o.assignment_id);
    }
  }

  const variants: VariantResult[] = [];
  for (const [name, bucket] of Array.from(byVariant.entries())) {
    const conversions = bucket.ids.filter((id) => conversionByAssignment.has(id)).length;
    variants.push({
      name,
      count: bucket.ids.length,
      conversions,
      conversion_rate:
        bucket.ids.length > 0
          ? Math.round((conversions / bucket.ids.length) * 10000) / 100
          : 0,
    });
  }

  variants.sort((a, b) => a.name.localeCompare(b.name));

  const minSample = experiment.min_sample_size ?? 50;
  const sample_ready = variants.every((v) => v.count >= minSample);

  let p_value: number | undefined;
  let winner: string | undefined = experiment.winner_variant ?? undefined;

  if (variants.length >= 2) {
    const sorted = [...variants].sort((a, b) => b.conversion_rate - a.conversion_rate);
    const top = sorted[0];
    const second = sorted[1];
    const p = twoProportionZTest(
      top.count,
      top.conversions,
      second.count,
      second.conversions,
    );
    if (p !== null) p_value = Math.round(p * 10000) / 10000;

    if (sample_ready && p_value !== undefined && p_value < 0.05) {
      winner = top.name;
      if (!experiment.winner_variant) {
        await supabase
          .from('ab_experiments')
          .update({ winner_variant: winner })
          .eq('id', experimentId);
        console.log(
          `[ab-testing] winner detected | exp=${experimentId} | winner=${winner} | p_value=${p_value}`,
        );
      }
    }
  }

  return {
    experiment_id: experimentId,
    variants,
    winner,
    p_value,
    sample_ready,
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
