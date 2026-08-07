import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { triggerEmailSequence } from '@/lib/email-tags';

export type EmailAutomation = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  triggerType: string;
  delayDays: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type AutomationRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  trigger_type: string;
  delay_days: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

function mapAutomation(row: AutomationRow): EmailAutomation {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    triggerType: row.trigger_type,
    delayDays: row.delay_days,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAutomations(
  supabase: SupabaseClient,
): Promise<EmailAutomation[]> {
  const { data, error } = await supabase
    .from('email_automations')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as AutomationRow[]).map(mapAutomation);
}

export async function setAutomationActive(
  supabase: SupabaseClient,
  id: string,
  active: boolean,
): Promise<EmailAutomation> {
  const { data, error } = await supabase
    .from('email_automations')
    .update({ active })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapAutomation(data as AutomationRow);
}

async function isAutomationActive(
  supabase: SupabaseClient,
  key: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('email_automations')
    .select('active')
    .eq('key', key)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.active);
}

const WELCOME_SEQUENCE_ID = 'a0000001-0000-4000-8000-000000000001';

/** Stripe → Bienvenida Pro/Max (welcome-transactional via sequence). */
export async function runWelcomePaidAutomation(params: {
  supabase: SupabaseClient;
  email: string;
  psychologistName?: string;
}): Promise<{ ran: boolean; sent: number; queued: number; skipped?: string }> {
  const active = await isAutomationActive(params.supabase, 'welcome_paid');
  if (!active) return { ran: false, sent: 0, queued: 0 };

  const email = params.email.trim().toLowerCase();

  // Cancel trial onboarding nudges when they convert
  await triggerEmailSequence(email, 'trial-convertido', params.psychologistName);

  const { data: already } = await params.supabase
    .from('email_logs')
    .select('id')
    .eq('to_email', email)
    .eq('sequence_id', WELCOME_SEQUENCE_ID)
    .limit(1)
    .maybeSingle();

  if (already) {
    return { ran: false, sent: 0, queued: 0, skipped: 'already_sent' };
  }

  const result = await triggerEmailSequence(
    email,
    'subscription-activo',
    params.psychologistName,
  );
  return { ran: true, sent: result.sent, queued: result.queued };
}

/** Trial enroll → onboarding day sequence. */
export async function runOnboardingTrialAutomation(params: {
  email: string;
  psychologistName?: string;
}): Promise<{ ran: boolean; sent: number; queued: number }> {
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  const active = await isAutomationActive(supabase, 'onboarding_trial');
  if (!active) return { ran: false, sent: 0, queued: 0 };

  const result = await triggerEmailSequence(
    params.email,
    'trial-activo',
    params.psychologistName,
  );
  return { ran: true, sent: result.sent, queued: result.queued };
}

/** Cancelación → recovery email (delay via sequence.delay_days = 3). */
export async function runRecoveryCancelledAutomation(params: {
  supabase: SupabaseClient;
  email: string;
  psychologistName?: string;
}): Promise<{ ran: boolean; sent: number; queued: number }> {
  const active = await isAutomationActive(params.supabase, 'recovery_cancelled');
  if (!active) return { ran: false, sent: 0, queued: 0 };

  const result = await triggerEmailSequence(
    params.email,
    'subscription-cancelado',
    params.psychologistName,
  );
  return { ran: true, sent: result.sent, queued: result.queued };
}
