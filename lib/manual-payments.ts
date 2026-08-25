import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getKalyoClient } from '@/lib/kalyo-supabase';
import { getUsdFxRates, mxnToUsd } from '@/lib/fx-rates';
import { processCustomerPaid } from '@/lib/conversation-outcome';
import {
  MANUAL_PAYMENT_PLANS,
  MANUAL_PAYMENT_PLATFORMS,
  type ManualPaymentPlan,
  type ManualPaymentPlatform,
  type ManualPaymentRow,
} from '@/lib/manual-payments-types';

export {
  MANUAL_PAYMENT_PLANS,
  MANUAL_PAYMENT_PLATFORMS,
  type ManualPaymentPlan,
  type ManualPaymentPlatform,
  type ManualPaymentRow,
} from '@/lib/manual-payments-types';

export type CreateManualPaymentInput = {
  psychologist_email: string;
  psychologist_name?: string | null;
  amount_mxn: number;
  amount_usd?: number | null;
  platform: ManualPaymentPlatform;
  plan: ManualPaymentPlan;
  starts_at: string;
  ends_at: string;
  notes?: string | null;
  created_by?: string | null;
};

export type CreateManualPaymentResult = {
  payment: ManualPaymentRow;
  kalyo: {
    psychologist_id: string;
    email: string;
    plan: string;
    subscription_status: string;
    subscription_current_period_end: string;
    plan_expires_at: string;
  };
  funnel: {
    outcome_updated: number;
    onboarding_updated: number;
    conversation_created: boolean;
  };
};

type KalyoPsychRow = {
  id: string;
  email: string;
  full_name: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
};

function isPlatform(value: string): value is ManualPaymentPlatform {
  return (MANUAL_PAYMENT_PLATFORMS as readonly string[]).includes(value);
}

function isPlan(value: string): value is ManualPaymentPlan {
  return (MANUAL_PAYMENT_PLANS as readonly string[]).includes(value);
}

function parseIsoDate(value: string, field: string): string {
  const trimmed = value.trim();
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) {
    throw new ManualPaymentValidationError(`Invalid ${field}`);
  }
  return d.toISOString();
}

export class ManualPaymentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ManualPaymentValidationError';
  }
}

export class ManualPaymentNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ManualPaymentNotFoundError';
  }
}

export function parseCreateManualPaymentBody(body: unknown): CreateManualPaymentInput {
  if (!body || typeof body !== 'object') {
    throw new ManualPaymentValidationError('Invalid JSON body');
  }
  const raw = body as Record<string, unknown>;

  const email =
    typeof raw.psychologist_email === 'string'
      ? raw.psychologist_email.trim().toLowerCase()
      : '';
  if (!email || !email.includes('@')) {
    throw new ManualPaymentValidationError('psychologist_email required');
  }

  const amount_mxn = Number(raw.amount_mxn);
  if (!Number.isFinite(amount_mxn) || amount_mxn <= 0) {
    throw new ManualPaymentValidationError('amount_mxn must be a positive number');
  }

  let amount_usd: number | null = null;
  if (raw.amount_usd != null && raw.amount_usd !== '') {
    amount_usd = Number(raw.amount_usd);
    if (!Number.isFinite(amount_usd) || amount_usd <= 0) {
      throw new ManualPaymentValidationError('amount_usd must be a positive number');
    }
  }

  const platform = typeof raw.platform === 'string' ? raw.platform.trim() : '';
  if (!isPlatform(platform)) {
    throw new ManualPaymentValidationError(
      `platform must be one of: ${MANUAL_PAYMENT_PLATFORMS.join(', ')}`,
    );
  }

  const plan = typeof raw.plan === 'string' ? raw.plan.trim() : '';
  if (!isPlan(plan)) {
    throw new ManualPaymentValidationError(
      `plan must be one of: ${MANUAL_PAYMENT_PLANS.join(', ')}`,
    );
  }

  if (typeof raw.starts_at !== 'string' || !raw.starts_at.trim()) {
    throw new ManualPaymentValidationError('starts_at required');
  }
  if (typeof raw.ends_at !== 'string' || !raw.ends_at.trim()) {
    throw new ManualPaymentValidationError('ends_at required');
  }

  const starts_at = parseIsoDate(raw.starts_at, 'starts_at');
  const ends_at = parseIsoDate(raw.ends_at, 'ends_at');
  if (new Date(ends_at).getTime() <= new Date(starts_at).getTime()) {
    throw new ManualPaymentValidationError('ends_at must be after starts_at');
  }

  const psychologist_name =
    typeof raw.psychologist_name === 'string' ? raw.psychologist_name.trim() || null : null;
  const notes = typeof raw.notes === 'string' ? raw.notes.trim() || null : null;
  const created_by =
    typeof raw.created_by === 'string' ? raw.created_by.trim() || null : null;

  return {
    psychologist_email: email,
    psychologist_name,
    amount_mxn,
    amount_usd,
    platform,
    plan,
    starts_at,
    ends_at,
    notes,
    created_by,
  };
}

function pickCanonicalPsych(rows: KalyoPsychRow[]): KalyoPsychRow {
  return [...rows].sort((a, b) => {
    const aScore =
      (a.full_name && a.full_name.length > 8 ? 2 : 0) + (a.stripe_subscription_id ? 2 : 0);
    const bScore =
      (b.full_name && b.full_name.length > 8 ? 2 : 0) + (b.stripe_subscription_id ? 2 : 0);
    if (bScore !== aScore) return bScore - aScore;
    return a.created_at.localeCompare(b.created_at);
  })[0]!;
}

async function resolveAmountUsd(
  amountMxn: number,
  amountUsd: number | null | undefined,
): Promise<number> {
  if (amountUsd != null && Number.isFinite(amountUsd) && amountUsd > 0) {
    return Math.round(amountUsd * 100) / 100;
  }
  const fx = await getUsdFxRates();
  return Math.round(mxnToUsd(amountMxn, fx.mxn_per_usd) * 100) / 100;
}

/**
 * Inserts manual_payments, upserts Kalyo psychologist subscription fields,
 * and marks Botio sales funnel as paid. Rolls back the Botio insert if Kalyo fails.
 */
export async function createManualPayment(
  botio: SupabaseClient,
  input: CreateManualPaymentInput,
): Promise<CreateManualPaymentResult> {
  const email = input.psychologist_email.trim().toLowerCase();
  const amount_usd = await resolveAmountUsd(input.amount_mxn, input.amount_usd);

  const kalyo = getKalyoClient();
  const { data: psychRows, error: psychError } = await kalyo
    .from('psychologists')
    .select('id, email, full_name, stripe_subscription_id, created_at')
    .eq('email', email);

  if (psychError) {
    throw new Error(`Kalyo lookup failed: ${psychError.message}`);
  }

  const accounts = (psychRows ?? []) as KalyoPsychRow[];
  if (accounts.length === 0) {
    throw new ManualPaymentNotFoundError(
      `No psychologist found in Kalyo for email=${email}`,
    );
  }

  const canonical = pickCanonicalPsych(accounts);
  const name = input.psychologist_name?.trim() || canonical.full_name;

  const { data: inserted, error: insertError } = await botio
    .from('manual_payments')
    .insert({
      psychologist_email: email,
      psychologist_name: name,
      amount_mxn: input.amount_mxn,
      amount_usd,
      platform: input.platform,
      plan: input.plan,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      notes: input.notes ?? null,
      created_by: input.created_by ?? 'admin',
    })
    .select('*')
    .single();

  if (insertError || !inserted) {
    throw new Error(insertError?.message ?? 'Failed to insert manual_payments');
  }

  const payment = inserted as ManualPaymentRow;

  const { error: updateError } = await kalyo
    .from('psychologists')
    .update({
      plan: input.plan,
      subscription_status: 'active',
      subscription_current_period_end: input.ends_at,
      plan_expires_at: input.ends_at,
      updated_at: new Date().toISOString(),
    })
    .eq('id', canonical.id);

  if (updateError) {
    await botio.from('manual_payments').delete().eq('id', payment.id);
    throw new Error(`Kalyo update failed: ${updateError.message}`);
  }

  const funnel = await processCustomerPaid(botio, email, 'manual_payment', {
    name,
  });

  return {
    payment,
    kalyo: {
      psychologist_id: canonical.id,
      email: canonical.email,
      plan: input.plan,
      subscription_status: 'active',
      subscription_current_period_end: input.ends_at,
      plan_expires_at: input.ends_at,
    },
    funnel,
  };
}

export async function listManualPayments(
  botio: SupabaseClient,
  options?: { activeOnly?: boolean; limit?: number },
): Promise<ManualPaymentRow[]> {
  let query = botio
    .from('manual_payments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 100);

  if (options?.activeOnly) {
    query = query.gt('ends_at', new Date().toISOString());
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ManualPaymentRow[];
}

/** Sum of amount_usd for payments still active (ends_at > now), divided by 12 → monthly. */
export async function getActiveManualMrrUsd(botio: SupabaseClient): Promise<{
  manual_mrr_usd: number;
  active_count: number;
  active_amount_usd: number;
}> {
  const stats = await getManualOnlySubscriberStats(botio);
  return {
    manual_mrr_usd: stats.manual_mrr_usd,
    active_count: stats.active_count,
    active_amount_usd: stats.active_amount_usd,
  };
}

async function fetchStripeLinkedEmails(): Promise<Set<string>> {
  const kalyo = getKalyoClient();
  const { data, error } = await kalyo
    .from('psychologists')
    .select('email')
    .not('stripe_subscription_id', 'is', null);

  if (error) {
    throw new Error(`Kalyo stripe-linked email lookup failed: ${error.message}`);
  }

  const emails = new Set<string>();
  for (const row of data ?? []) {
    const email = (row.email as string | null)?.trim().toLowerCase();
    if (email) emails.add(email);
  }
  return emails;
}

/**
 * Manual payments that are NOT already represented by a Stripe-linked Kalyo account.
 * Used to supplement Stripe active/new counts without double counting.
 */
export async function getManualOnlySubscriberStats(botio: SupabaseClient): Promise<{
  active_count: number;
  new_this_month: number;
  manual_mrr_usd: number;
  active_amount_usd: number;
  active_emails: string[];
}> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartIso = monthStart.toISOString();
  const nowIso = new Date().toISOString();

  const [{ data: manualRows, error }, stripeLinked] = await Promise.all([
    botio
      .from('manual_payments')
      .select('psychologist_email, amount_usd, starts_at, ends_at')
      .gt('ends_at', nowIso),
    fetchStripeLinkedEmails(),
  ]);

  if (error) throw new Error(error.message);

  const activeEmails = new Set<string>();
  let active_amount_usd = 0;
  let new_this_month = 0;

  for (const row of manualRows ?? []) {
    const email = (row.psychologist_email as string | null)?.trim().toLowerCase() ?? '';
    if (!email || stripeLinked.has(email)) continue;
    if (activeEmails.has(email)) continue;

    activeEmails.add(email);
    active_amount_usd += Number(row.amount_usd ?? 0);

    const startsAt = row.starts_at as string | null;
    if (startsAt && startsAt >= monthStartIso) {
      new_this_month += 1;
    }
  }

  const manual_mrr_usd = Math.round((active_amount_usd / 12) * 100) / 100;

  return {
    active_count: activeEmails.size,
    new_this_month,
    manual_mrr_usd,
    active_amount_usd: Math.round(active_amount_usd * 100) / 100,
    active_emails: Array.from(activeEmails),
  };
}
