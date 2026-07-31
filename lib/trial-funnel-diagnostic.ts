import type { SupabaseClient } from '@supabase/supabase-js';

export const TRIAL_FUNNEL_DEFAULT_DAYS = 30;

export type DripStepKey =
  | 'total'
  | 'welcome_d1'
  | 'day2'
  | 'day3'
  | 'day5'
  | 'day6'
  | 'day7_expired'
  | 'day9'
  | 'responded'
  | 'paid_onboarding';

export type DripFunnelStep = {
  step: DripStepKey;
  label: string;
  count: number;
  pct_of_total: number;
  drop_from_prev: number | null;
};

export type WelcomeDeliveryBreakdown = {
  welcome_msg_status: string | null;
  welcome_msg_method: string | null;
  count: number;
};

export type TrialEngagementRow = {
  email: string;
  trial_started_at: string;
  trial_ends_at: string;
  welcome_sent: boolean;
  day7_expired_sent: boolean;
  customer_responded: boolean;
  upgraded_to_paid: boolean;
  source: string | null;
  kalyo_found: boolean;
  subscription_status: string | null;
  logged_in_during_trial: boolean;
  login_count_during_trial: number;
  patients_created: number;
  assessments_applied: number;
  voice_sessions: number | null;
  days_active_in_trial: number;
};

export type TrialFunnelReport = {
  generated_at: string;
  period_days: number;
  period_start: string;
  botio: {
    drip_funnel: DripFunnelStep[];
    welcome_delivery: WelcomeDeliveryBreakdown[];
    anomalies: {
      no_welcome_but_day7: number;
      welcome_failed: number;
    };
    trial_to_paid_pct: number;
  };
  kalyo: {
    available: boolean;
    error?: string;
    trials_matched: number;
    engagement_summary: {
      logged_in_pct: number;
      created_patient_pct: number;
      applied_test_pct: number;
      voice_used_pct: number | null;
      completed_day7_message_pct: number;
    };
    rows: TrialEngagementRow[];
  };
  paid_outside_onboarding: Array<{
    email: string;
    source: string | null;
    outcome_date: string;
    in_trial_onboarding: boolean;
  }>;
};

const DRIP_LABELS: Record<DripStepKey, string> = {
  total: 'Trials enrollados',
  welcome_d1: 'Día 1 — Welcome enviado',
  day2: 'Día 2 — Primer paciente',
  day3: 'Día 3 — Tests PHQ/GAD',
  day5: 'Día 5 — Kaly voz',
  day6: 'Día 6 — Urgencia',
  day7_expired: 'Día 7 — Trial vencido',
  day9: 'Día 9 — PRIMER50',
  responded: 'Respondió WhatsApp',
  paid_onboarding: 'Paid (onboarding)',
};

type TrialOnboardingRow = {
  trial_user_email: string;
  trial_started_at: string;
  trial_ends_at: string;
  day_1_sent_at: string | null;
  day_15_sent_at: string | null;
  customer_responded: boolean;
  upgraded_to_paid_at: string | null;
  welcome_msg_status: string | null;
  welcome_msg_method: string | null;
  conversation_id: string | null;
};

type PsychologistRow = {
  id: string;
  email: string;
  subscription_status: string | null;
  trial_ends_at: string | null;
  created_at: string | null;
};

function pct(num: number, den: number): number {
  if (den <= 0) return 0;
  return Math.round((num / den) * 1000) / 10;
}

function countInTrialWindow(
  rows: Array<{ created_at: string }>,
  trialStart: string,
  trialEnd: string,
): number {
  const start = new Date(trialStart).getTime();
  const end = new Date(trialEnd).getTime();
  const days = new Set<string>();
  for (const row of rows) {
    const t = new Date(row.created_at).getTime();
    if (t >= start && t <= end) {
      days.add(row.created_at.slice(0, 10));
    }
  }
  return days.size;
}

export async function fetchBotioTrialRows(
  botio: SupabaseClient,
  sinceIso: string,
): Promise<TrialOnboardingRow[]> {
  const { data, error } = await botio
    .from('trial_onboarding_messages')
    .select(
      'trial_user_email, trial_started_at, trial_ends_at, day_1_sent_at, day_15_sent_at, customer_responded, upgraded_to_paid_at, welcome_msg_status, welcome_msg_method, conversation_id',
    )
    .gte('trial_started_at', sinceIso);

  if (error) throw new Error(error.message);
  return (data ?? []) as TrialOnboardingRow[];
}

export function buildDripFunnel(counts: Record<DripStepKey, number>): DripFunnelStep[] {
  const total = counts.total || 0;
  const order: DripStepKey[] = [
    'total',
    'welcome_d1',
    'day2',
    'day3',
    'day5',
    'day6',
    'day7_expired',
    'day9',
    'responded',
    'paid_onboarding',
  ];

  const dripSequence: DripStepKey[] = [
    'welcome_d1',
    'day2',
    'day3',
    'day5',
    'day6',
    'day7_expired',
    'day9',
  ];

  let prevDrip = total;
  return order.map((step, index) => {
    const count = counts[step] ?? 0;
    let drop: number | null = null;
    if (index === 0) {
      drop = null;
    } else if (dripSequence.includes(step)) {
      drop = prevDrip - count;
      prevDrip = count;
    } else {
      drop = null;
    }
    return {
      step,
      label: DRIP_LABELS[step],
      count,
      pct_of_total: pct(count, total),
      drop_from_prev: drop,
    };
  });
}

export async function fetchBotioDripCounts(
  botio: SupabaseClient,
  sinceIso: string,
): Promise<{ counts: Record<DripStepKey, number>; welcome: WelcomeDeliveryBreakdown[]; anomalies: TrialFunnelReport['botio']['anomalies'] }> {
  const rows = await fetchBotioTrialRows(botio, sinceIso);

  const counts: Record<DripStepKey, number> = {
    total: rows.length,
    welcome_d1: 0,
    day2: 0,
    day3: 0,
    day5: 0,
    day6: 0,
    day7_expired: 0,
    day9: 0,
    responded: 0,
    paid_onboarding: 0,
  };

  let noWelcomeButDay7 = 0;
  let welcomeFailed = 0;
  const welcomeMap = new Map<string, number>();

  for (const row of rows) {
    if (row.day_1_sent_at) counts.welcome_d1 += 1;
    if (row.customer_responded) counts.responded += 1;
    if (row.upgraded_to_paid_at) counts.paid_onboarding += 1;
    if (!row.day_1_sent_at && row.day_15_sent_at) noWelcomeButDay7 += 1;
    if (row.welcome_msg_status === 'failed') welcomeFailed += 1;

    const wKey = `${row.welcome_msg_status ?? 'null'}|${row.welcome_msg_method ?? 'null'}`;
    welcomeMap.set(wKey, (welcomeMap.get(wKey) ?? 0) + 1);
  }

  const { data: dripCols, error } = await botio
    .from('trial_onboarding_messages')
    .select('day_2_sent_at, day_3_sent_at, day_7_sent_at, day_13_sent_at, day_15_sent_at, day_9_sent_at')
    .gte('trial_started_at', sinceIso);

  if (error) throw new Error(error.message);

  for (const row of dripCols ?? []) {
    if (row.day_2_sent_at) counts.day2 += 1;
    if (row.day_3_sent_at) counts.day3 += 1;
    if (row.day_7_sent_at) counts.day5 += 1;
    if (row.day_13_sent_at) counts.day6 += 1;
    if (row.day_15_sent_at) counts.day7_expired += 1;
    if (row.day_9_sent_at) counts.day9 += 1;
  }

  const welcome: WelcomeDeliveryBreakdown[] = [...welcomeMap.entries()].map(([key, count]) => {
    const [status, method] = key.split('|');
    return {
      welcome_msg_status: status === 'null' ? null : status,
      welcome_msg_method: method === 'null' ? null : method,
      count,
    };
  });

  welcome.sort((a, b) => b.count - a.count);

  return {
    counts,
    welcome,
    anomalies: { no_welcome_but_day7: noWelcomeButDay7, welcome_failed: welcomeFailed },
  };
}

async function fetchConversationSources(
  botio: SupabaseClient,
  conversationIds: string[],
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (conversationIds.length === 0) return map;

  const chunks: string[][] = [];
  for (let i = 0; i < conversationIds.length; i += 100) {
    chunks.push(conversationIds.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    const { data, error } = await botio
      .from('conversations')
      .select('id, metadata')
      .in('id', chunk);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const meta = row.metadata as Record<string, unknown> | null;
      map.set(row.id as string, typeof meta?.source === 'string' ? meta.source : null);
    }
  }

  return map;
}

async function tableExists(kalyo: SupabaseClient, table: string): Promise<boolean> {
  try {
    const { error } = await kalyo.from(table).select('*', { head: true, count: 'exact' });
    if (!error) return true;
    const msg = error.message.toLowerCase();
    if (msg.includes('does not exist') || msg.includes('schema cache')) return false;
    return false;
  } catch {
    return false;
  }
}

async function safeCountByPsychologist(
  kalyo: SupabaseClient,
  table: string,
  psychIds: string[],
  select: string,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (psychIds.length === 0) return counts;

  for (let i = 0; i < psychIds.length; i += 100) {
    const chunk = psychIds.slice(i, i + 100);
    const { data, error } = await kalyo.from(table).select(select).in('psychologist_id', chunk);
    if (error) {
      console.warn(`[trial-funnel] skip ${table}: ${error.message}`);
      return counts;
    }
    for (const row of data ?? []) {
      const record = row as Record<string, unknown>;
      const id = record.psychologist_id as string;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
}

async function safeRowsByPsychologist(
  kalyo: SupabaseClient,
  table: string,
  psychIds: string[],
  select: string,
): Promise<Map<string, Array<{ created_at: string }>>> {
  const byPsych = new Map<string, Array<{ created_at: string }>>();
  if (psychIds.length === 0) return byPsych;

  for (let i = 0; i < psychIds.length; i += 100) {
    const chunk = psychIds.slice(i, i + 100);
    const { data, error } = await kalyo.from(table).select(select).in('psychologist_id', chunk);
    if (error) {
      console.warn(`[trial-funnel] skip ${table}: ${error.message}`);
      return byPsych;
    }
    for (const row of data ?? []) {
      const record = row as Record<string, unknown>;
      const id = record.psychologist_id as string;
      const list = byPsych.get(id) ?? [];
      list.push({ created_at: String(record.created_at) });
      byPsych.set(id, list);
    }
  }
  return byPsych;
}

export async function fetchKalyoEngagementForTrials(
  kalyo: SupabaseClient,
  trials: TrialOnboardingRow[],
): Promise<{ rows: TrialEngagementRow[]; voiceTableAvailable: boolean }> {
  const emails = [...new Set(trials.map((t) => t.trial_user_email.trim().toLowerCase()))];
  const psychByEmail = new Map<string, PsychologistRow>();

  for (let i = 0; i < emails.length; i += 100) {
    const chunk = emails.slice(i, i + 100);
    const { data, error } = await kalyo
      .from('psychologists')
      .select('id, email, subscription_status, trial_ends_at, created_at')
      .in('email', chunk);
    if (error) throw new Error(`psychologists: ${error.message}`);
    for (const row of (data ?? []) as PsychologistRow[]) {
      psychByEmail.set(row.email.trim().toLowerCase(), row);
    }
  }

  const psychIds = [...psychByEmail.values()].map((p) => p.id);

  const hasPatients = await tableExists(kalyo, 'patients');
  const hasAssessments = await tableExists(kalyo, 'assessments');
  const hasLoginHistory = await tableExists(kalyo, 'login_history');
  const hasVoiceSessions = await tableExists(kalyo, 'voice_sessions');
  const hasSessions = !hasVoiceSessions && (await tableExists(kalyo, 'sessions'));

  const patientsByPsych = hasPatients
    ? await safeCountByPsychologist(kalyo, 'patients', psychIds, 'psychologist_id')
    : new Map<string, number>();

  const assessmentsByPsych = hasAssessments
    ? await safeRowsByPsychologist(kalyo, 'assessments', psychIds, 'psychologist_id, created_at')
    : new Map<string, Array<{ created_at: string }>>();

  const loginsByPsych = hasLoginHistory
    ? await safeRowsByPsychologist(kalyo, 'login_history', psychIds, 'psychologist_id, created_at')
    : new Map<string, Array<{ created_at: string }>>();

  let voiceByPsych = new Map<string, number>();
  if (hasVoiceSessions) {
    voiceByPsych = await safeCountByPsychologist(
      kalyo,
      'voice_sessions',
      psychIds,
      'psychologist_id',
    );
  } else if (hasSessions) {
    voiceByPsych = await safeCountByPsychologist(kalyo, 'sessions', psychIds, 'psychologist_id');
  }

  const voiceTableAvailable = hasVoiceSessions || hasSessions;

  const rows: TrialEngagementRow[] = trials.map((trial) => {
    const email = trial.trial_user_email.trim().toLowerCase();
    const psych = psychByEmail.get(email);
    const trialStart = trial.trial_started_at;
    const trialEnd = trial.trial_ends_at;

    const loginRows = psych ? loginsByPsych.get(psych.id) ?? [] : [];
    const loginsInTrial = loginRows.filter((l) => {
      const t = new Date(l.created_at).getTime();
      return t >= new Date(trialStart).getTime() && t <= new Date(trialEnd).getTime();
    });

    const assessmentRows = psych ? assessmentsByPsych.get(psych.id) ?? [] : [];
    const assessmentsInTrial = assessmentRows.filter((a) => {
      const t = new Date(a.created_at).getTime();
      return t >= new Date(trialStart).getTime() && t <= new Date(trialEnd).getTime();
    });

    return {
      email,
      trial_started_at: trialStart,
      trial_ends_at: trialEnd,
      welcome_sent: Boolean(trial.day_1_sent_at),
      day7_expired_sent: Boolean(trial.day_15_sent_at),
      customer_responded: trial.customer_responded,
      upgraded_to_paid: Boolean(trial.upgraded_to_paid_at),
      source: null,
      kalyo_found: Boolean(psych),
      subscription_status: psych?.subscription_status ?? null,
      logged_in_during_trial: loginsInTrial.length > 0,
      login_count_during_trial: loginsInTrial.length,
      patients_created: psych ? patientsByPsych.get(psych.id) ?? 0 : 0,
      assessments_applied: assessmentsInTrial.length,
      voice_sessions: psych && voiceTableAvailable ? voiceByPsych.get(psych.id) ?? 0 : null,
      days_active_in_trial: countInTrialWindow(loginsInTrial, trialStart, trialEnd),
    };
  });

  return { rows, voiceTableAvailable: hasVoiceSessions || hasSessions };
}

export async function fetchPaidOutsideOnboarding(
  botio: SupabaseClient,
  sinceIso: string,
  onboardingEmails: Set<string>,
): Promise<TrialFunnelReport['paid_outside_onboarding']> {
  const { data, error } = await botio
    .from('conversations')
    .select('metadata, outcome_date')
    .eq('outcome', 'paid')
    .gte('outcome_date', sinceIso)
    .or('is_ambassador.is.null,is_ambassador.eq.false');

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row) => {
      const meta = row.metadata as Record<string, unknown> | null;
      const email =
        typeof meta?.customer_email === 'string'
          ? meta.customer_email.trim().toLowerCase()
          : typeof meta?.email === 'string'
            ? meta.email.trim().toLowerCase()
            : null;
      if (!email) return null;
      return {
        email,
        source: typeof meta?.source === 'string' ? meta.source : null,
        outcome_date: row.outcome_date as string,
        in_trial_onboarding: onboardingEmails.has(email),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
}

function summarizeEngagement(rows: TrialEngagementRow[], voiceAvailable: boolean) {
  const matched = rows.filter((r) => r.kalyo_found);
  const n = matched.length || 1;
  return {
    logged_in_pct: pct(matched.filter((r) => r.logged_in_during_trial).length, matched.length),
    created_patient_pct: pct(matched.filter((r) => r.patients_created > 0).length, matched.length),
    applied_test_pct: pct(matched.filter((r) => r.assessments_applied > 0).length, matched.length),
    voice_used_pct: voiceAvailable
      ? pct(matched.filter((r) => (r.voice_sessions ?? 0) > 0).length, matched.length)
      : null,
    completed_day7_message_pct: pct(rows.filter((r) => r.day7_expired_sent).length, rows.length || n),
  };
}

export async function buildTrialFunnelReport(
  botio: SupabaseClient,
  options?: { days?: number; kalyo?: SupabaseClient | null },
): Promise<TrialFunnelReport> {
  const days = options?.days ?? TRIAL_FUNNEL_DEFAULT_DAYS;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const sinceIso = since.toISOString();

  const [{ counts, welcome, anomalies }, trialRows] = await Promise.all([
    fetchBotioDripCounts(botio, sinceIso),
    fetchBotioTrialRows(botio, sinceIso),
  ]);

  const drip = buildDripFunnel(counts);
  const onboardingEmails = new Set(
    trialRows.map((t) => t.trial_user_email.trim().toLowerCase()),
  );

  const convIds = trialRows
    .map((t) => t.conversation_id)
    .filter((id): id is string => Boolean(id));
  const sources = await fetchConversationSources(botio, convIds);

  let kalyoSection: TrialFunnelReport['kalyo'] = {
    available: false,
    trials_matched: 0,
    engagement_summary: {
      logged_in_pct: 0,
      created_patient_pct: 0,
      applied_test_pct: 0,
      voice_used_pct: null,
      completed_day7_message_pct: pct(
        trialRows.filter((t) => t.day_15_sent_at).length,
        trialRows.length,
      ),
    },
    rows: [],
  };

  let engagementRows: TrialEngagementRow[] = trialRows.map((trial) => ({
    email: trial.trial_user_email.trim().toLowerCase(),
    trial_started_at: trial.trial_started_at,
    trial_ends_at: trial.trial_ends_at,
    welcome_sent: Boolean(trial.day_1_sent_at),
    day7_expired_sent: Boolean(trial.day_15_sent_at),
    customer_responded: trial.customer_responded,
    upgraded_to_paid: Boolean(trial.upgraded_to_paid_at),
    source: trial.conversation_id ? sources.get(trial.conversation_id) ?? null : null,
    kalyo_found: false,
    subscription_status: null,
    logged_in_during_trial: false,
    login_count_during_trial: 0,
    patients_created: 0,
    assessments_applied: 0,
    voice_sessions: null,
    days_active_in_trial: 0,
  }));

  if (options?.kalyo) {
    try {
      const { rows, voiceTableAvailable } = await fetchKalyoEngagementForTrials(
        options.kalyo,
        trialRows,
      );
      engagementRows = rows.map((row) => {
        const trial = trialRows.find(
          (t) => t.trial_user_email.trim().toLowerCase() === row.email,
        );
        return {
          ...row,
          source: trial?.conversation_id ? sources.get(trial.conversation_id) ?? null : null,
        };
      });
      kalyoSection = {
        available: true,
        trials_matched: engagementRows.filter((r) => r.kalyo_found).length,
        engagement_summary: summarizeEngagement(engagementRows, voiceTableAvailable),
        rows: engagementRows,
      };
    } catch (err) {
      kalyoSection = {
        ...kalyoSection,
        available: false,
        error: err instanceof Error ? err.message : String(err),
        rows: engagementRows,
      };
    }
  } else {
    kalyoSection.rows = engagementRows;
  }

  const paidOutside = await fetchPaidOutsideOnboarding(botio, sinceIso, onboardingEmails);

  return {
    generated_at: new Date().toISOString(),
    period_days: days,
    period_start: sinceIso,
    botio: {
      drip_funnel: drip,
      welcome_delivery: welcome,
      anomalies,
      trial_to_paid_pct: pct(counts.paid_onboarding, counts.total),
    },
    kalyo: kalyoSection,
    paid_outside_onboarding: paidOutside,
  };
}

export function formatTrialFunnelReport(report: TrialFunnelReport): string {
  const lines: string[] = [];
  lines.push(`# Trial funnel diagnostic (${report.period_days}d)`);
  lines.push(`Generated: ${report.generated_at}`);
  lines.push('');
  lines.push('## WhatsApp drip (Botio)');
  lines.push('| Step | Count | % total | Drop |');
  lines.push('|------|------:|--------:|-----:|');
  for (const step of report.botio.drip_funnel) {
    lines.push(
      `| ${step.label} | ${step.count} | ${step.pct_of_total}% | ${step.drop_from_prev ?? '—'} |`,
    );
  }
  lines.push('');
  lines.push(`Trial→paid (onboarding): **${report.botio.trial_to_paid_pct}%**`);
  lines.push(
    `Anomalies: ${report.botio.anomalies.no_welcome_but_day7} trials got day-7 without welcome; ${report.botio.anomalies.welcome_failed} welcome failed`,
  );

  if (report.kalyo.available) {
    const s = report.kalyo.engagement_summary;
    lines.push('');
    lines.push('## Product engagement (Kalyo)');
    lines.push(`Matched psychologists: ${report.kalyo.trials_matched}`);
    lines.push(`- Logged in during trial: ${s.logged_in_pct}%`);
    lines.push(`- Created ≥1 patient: ${s.created_patient_pct}%`);
    lines.push(`- Applied ≥1 test: ${s.applied_test_pct}%`);
    if (s.voice_used_pct != null) lines.push(`- Used voice: ${s.voice_used_pct}%`);
  } else if (report.kalyo.error) {
    lines.push('');
    lines.push(`## Kalyo (skipped): ${report.kalyo.error}`);
  }

  if (report.paid_outside_onboarding.length > 0) {
    lines.push('');
    lines.push('## Paid outside onboarding drip');
    for (const p of report.paid_outside_onboarding) {
      lines.push(
        `- ${p.email} | source=${p.source ?? '—'} | in_onboarding=${p.in_trial_onboarding} | ${p.outcome_date}`,
      );
    }
  }

  return lines.join('\n');
}
