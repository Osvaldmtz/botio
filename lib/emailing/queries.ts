import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { personalizeTemplate, triggerLabel } from './personalize';
import type {
  EmailLog,
  EmailLogRow,
  EmailMetrics,
  EmailSequence,
  EmailSequenceRow,
} from './types';

const PAGE_SIZE = 20;

function mapSequence(row: EmailSequenceRow): EmailSequence {
  return {
    id: row.id,
    name: row.name,
    triggerTag: row.trigger_tag,
    cancelOnTag: row.cancel_on_tag,
    delayDays: row.delay_days,
    subject: row.subject,
    htmlTemplate: row.html_template,
    active: row.active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLog(row: EmailLogRow): EmailLog {
  const campaignName = row.campaign_name?.trim() || null;
  return {
    id: row.id,
    to: row.to_email,
    sequenceId: row.sequence_id,
    campaignId: row.campaign_id ?? null,
    campaign: campaignName,
    sequence: campaignName ?? row.email_sequences?.name ?? '—',
    status: row.status,
    sentAt: row.sent_at,
    emailId: row.resend_id ?? '',
    openedAt: row.opened_at,
    errorMessage: row.error_message ?? null,
  };
}

export async function listSequences(
  supabase: SupabaseClient,
): Promise<EmailSequence[]> {
  const { data, error } = await supabase
    .from('email_sequences')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return ((data ?? []) as EmailSequenceRow[]).map(mapSequence);
}

export async function getSequence(
  supabase: SupabaseClient,
  id: string,
): Promise<EmailSequence | null> {
  const { data, error } = await supabase
    .from('email_sequences')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapSequence(data as EmailSequenceRow);
}

export async function patchSequence(
  supabase: SupabaseClient,
  id: string,
  patch: { active?: boolean; delayDays?: number },
): Promise<EmailSequence> {
  const update: Record<string, unknown> = {};
  if (typeof patch.active === 'boolean') update.active = patch.active;
  if (typeof patch.delayDays === 'number') {
    if (!Number.isInteger(patch.delayDays) || patch.delayDays < 0) {
      throw new Error('delayDays must be a non-negative integer');
    }
    update.delay_days = patch.delayDays;
  }
  if (Object.keys(update).length === 0) {
    throw new Error('No valid fields to update');
  }

  const { data, error } = await supabase
    .from('email_sequences')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return mapSequence(data as EmailSequenceRow);
}

export async function listLogs(
  supabase: SupabaseClient,
  page = 1,
): Promise<{ logs: EmailLog[]; page: number; pageSize: number; total: number }> {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const from = (safePage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error, count } = await supabase
    .from('email_logs')
    .select('*, email_sequences(name)', { count: 'exact' })
    .order('sent_at', { ascending: false })
    .range(from, to);

  if (error) throw error;

  return {
    logs: ((data ?? []) as EmailLogRow[]).map(mapLog),
    page: safePage,
    pageSize: PAGE_SIZE,
    total: count ?? 0,
  };
}

export async function getLogPreview(
  supabase: SupabaseClient,
  logId: string,
): Promise<{ subject: string; html: string; to: string; sequence: string } | null> {
  const { data, error } = await supabase
    .from('email_logs')
    .select('to_email, sequence_id, email_sequences(name, subject, html_template)')
    .eq('id', logId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const seq = data.email_sequences as unknown as {
    name: string;
    subject: string;
    html_template: string;
  } | null;

  if (!seq) return null;

  return {
    to: data.to_email as string,
    sequence: seq.name,
    subject: seq.subject,
    html: seq.html_template,
  };
}

export async function getSequencePreview(
  supabase: SupabaseClient,
  id: string,
  psychologistName?: string,
): Promise<{ subject: string; html: string; sequence: string; trigger: string } | null> {
  const sequence = await getSequence(supabase, id);
  if (!sequence) return null;

  return {
    sequence: sequence.name,
    subject: sequence.subject,
    html: personalizeTemplate(sequence.htmlTemplate, psychologistName ?? 'María'),
    trigger: triggerLabel(sequence.triggerTag, sequence.cancelOnTag),
  };
}

export async function getMetrics(
  supabase: SupabaseClient,
): Promise<EmailMetrics> {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data, error } = await supabase
    .from('email_logs')
    .select('id, sequence_id, status, opened_at, clicked_at, email_sequences(name)')
    .gte('sent_at', since.toISOString());

  if (error) throw error;

  type Row = {
    id: string;
    sequence_id: string | null;
    status: string;
    opened_at: string | null;
    clicked_at: string | null;
    email_sequences: { name: string } | null;
  };

  const rows = (data ?? []) as unknown as Row[];
  const totalSent = rows.length;
  const opened = rows.filter((r) => r.status === 'opened' || r.opened_at).length;
  const clicked = rows.filter((r) => r.clicked_at).length;
  const bounced = rows.filter((r) => r.status === 'bounced').length;

  const byId = new Map<
    string,
    {
      sequenceId: string;
      sequence: string;
      sent: number;
      opened: number;
      clicked: number;
      bounced: number;
    }
  >();

  for (const row of rows) {
    const key = row.sequence_id ?? 'campaign';
    const current = byId.get(key) ?? {
      sequenceId: row.sequence_id ?? 'campaign',
      sequence: row.email_sequences?.name ?? 'Campañas',
      sent: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
    };
    current.sent += 1;
    if (row.status === 'opened' || row.opened_at) current.opened += 1;
    if (row.clicked_at) current.clicked += 1;
    if (row.status === 'bounced') current.bounced += 1;
    byId.set(key, current);
  }

  const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10);

  return {
    totalSent,
    openRate: pct(opened, totalSent),
    clickRate: pct(clicked, totalSent),
    bounceRate: pct(bounced, totalSent),
    bySequence: Array.from(byId.values()).map((s) => ({
      ...s,
      openRate: pct(s.opened, s.sent),
      clickRate: pct(s.clicked, s.sent),
      bounceRate: pct(s.bounced, s.sent),
    })),
  };
}
