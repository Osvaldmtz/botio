import 'server-only';
import { subDays } from 'date-fns';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { getKalyoClient } from '@/lib/kalyo-supabase';
import {
  buildDripFunnel,
  fetchBotioDripCounts,
  type DripFunnelStep,
} from '@/lib/trial-funnel-diagnostic';
import {
  DAY8_SURVEY_LABELS,
  type Day8SurveyResponse,
} from '@/lib/trial-onboarding-day8-survey';
import { fetchSofiaSalesMetrics, type SofiaSalesMetrics } from '@/lib/sofia-sales-metrics';
import type { KalyoMetricRow } from '@/lib/kpi/types';

export type PatientInboundPsychologistRow = {
  psychologist_id: string;
  psychologist_name: string | null;
  message_count: number;
  unique_patients: number;
};

export type PatientInboundMetrics = {
  available: boolean;
  total_30d: number;
  unique_patients_30d: number;
  repeat_patients_30d: number;
  psychologists_notified_30d: number;
  by_psychologist: PatientInboundPsychologistRow[];
};

export type WhatsAppRoutingMetrics = {
  patient_redirected_30d: number;
  sofia_user_messages_30d: number;
  redirect_rate_pct: number;
  kalyo_bot_configured: boolean;
};

export type TrialDay8SurveyMetrics = {
  sent_30d: number;
  responded_30d: number;
  pending_30d: number;
  response_rate_pct: number;
  breakdown: Record<string, number>;
};

export type TrialOnboardingMetrics = {
  enrolled_30d: number;
  upgraded_30d: number;
  conversion_rate_pct: number;
  response_rate_pct: number;
  unsubscribe_rate_pct: number;
  drip_funnel: DripFunnelStep[];
  day8_survey: TrialDay8SurveyMetrics;
  day9_primer50_sent_30d: number;
};

export type OperationalMetrics = {
  patientInbound: PatientInboundMetrics;
  whatsappRouting: WhatsAppRoutingMetrics;
  trialOnboarding: TrialOnboardingMetrics;
  sofiaSales: SofiaSalesMetrics;
};

const PERIOD_DAYS = 30;

function emptyDay8SurveyMetrics(): TrialDay8SurveyMetrics {
  const breakdown: Record<string, number> = {};
  for (const label of Object.values(DAY8_SURVEY_LABELS)) {
    breakdown[label] = 0;
  }
  return {
    sent_30d: 0,
    responded_30d: 0,
    pending_30d: 0,
    response_rate_pct: 0,
    breakdown,
  };
}

export function emptyPatientInboundMetrics(): PatientInboundMetrics {
  return {
    available: false,
    total_30d: 0,
    unique_patients_30d: 0,
    repeat_patients_30d: 0,
    psychologists_notified_30d: 0,
    by_psychologist: [],
  };
}

export function emptyWhatsAppRoutingMetrics(
  patientRedirected = 0,
): WhatsAppRoutingMetrics {
  return {
    patient_redirected_30d: patientRedirected,
    sofia_user_messages_30d: 0,
    redirect_rate_pct: 0,
    kalyo_bot_configured: Boolean(process.env.KALYO_BOT_ID),
  };
}

export function emptyTrialOnboardingMetrics(): TrialOnboardingMetrics {
  return {
    enrolled_30d: 0,
    upgraded_30d: 0,
    conversion_rate_pct: 0,
    response_rate_pct: 0,
    unsubscribe_rate_pct: 0,
    drip_funnel: [],
    day8_survey: emptyDay8SurveyMetrics(),
    day9_primer50_sent_30d: 0,
  };
}

export function emptySofiaSalesMetrics(): SofiaSalesMetrics {
  return {
    max_share_pct: null,
    plan_pro: 0,
    plan_max: 0,
    trial_offers_30d: 0,
    trial_activations_30d: 0,
    primer50_links_sent_30d: 0,
    coupon_share_pct: null,
    purchase_intent_max_30d: 0,
    purchase_intent_pro_30d: 0,
    max_vs_pro_intent_ratio: null,
    max_share_trend_7d: [],
  };
}

export function emptyOperationalMetrics(): OperationalMetrics {
  return {
    patientInbound: emptyPatientInboundMetrics(),
    whatsappRouting: emptyWhatsAppRoutingMetrics(),
    trialOnboarding: emptyTrialOnboardingMetrics(),
    sofiaSales: emptySofiaSalesMetrics(),
  };
}

function pct(num: number, den: number): number {
  if (den <= 0) return 0;
  return Math.round((num / den) * 1000) / 10;
}

async function tableExists(supabase: SupabaseClient, table: string): Promise<boolean> {
  try {
    const { error } = await supabase.from(table).select('*', { head: true, count: 'exact' });
    if (!error) return true;
    const msg = error.message.toLowerCase();
    return !msg.includes('does not exist') && !msg.includes('schema cache');
  } catch {
    return false;
  }
}

async function enrichPsychologistNames(
  rows: Array<{ psychologist_id: string; message_count: number; unique_patients: number }>,
): Promise<PatientInboundPsychologistRow[]> {
  if (rows.length === 0) return [];

  let kalyo;
  try {
    kalyo = getKalyoClient();
  } catch {
    return rows.map((r) => ({
      psychologist_id: r.psychologist_id,
      psychologist_name: null,
      message_count: r.message_count,
      unique_patients: r.unique_patients,
    }));
  }

  try {
    const ids = rows.map((r) => r.psychologist_id);
    const { data, error } = await kalyo
      .from('psychologists')
      .select('id, full_name')
      .in('id', ids);

    if (error) {
      console.error('[operational-metrics] psychologist name lookup failed', error);
      throw error;
    }

    const nameById = new Map(
      (data ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? null]),
    );

    return rows.map((r) => ({
      psychologist_id: r.psychologist_id,
      psychologist_name: nameById.get(r.psychologist_id) ?? null,
      message_count: r.message_count,
      unique_patients: r.unique_patients,
    }));
  } catch (error) {
    console.error('[operational-metrics] enrichPsychologistNames failed', error);
    return rows.map((r) => ({
      psychologist_id: r.psychologist_id,
      psychologist_name: null,
      message_count: r.message_count,
      unique_patients: r.unique_patients,
    }));
  }
}

export async function fetchPatientInboundMetrics(
  supabase: SupabaseClient,
  sinceIso: string,
): Promise<PatientInboundMetrics> {
  const empty = emptyPatientInboundMetrics();

  try {
    const exists = await tableExists(supabase, 'patient_inbound_events');
    if (!exists) return empty;

    const { data, error } = await supabase
      .from('patient_inbound_events')
      .select(
        'patient_phone, patient_id, psychologist_id, psychologist_notified, created_at',
      )
      .gte('created_at', sinceIso);

    if (error) {
      console.error('[operational-metrics] patient_inbound_events query failed', error);
      return empty;
    }

    const rows = data ?? [];
    const uniquePatients = new Set<string>();
    const patientCounts = new Map<string, number>();
    const psychStats = new Map<string, { messages: number; patients: Set<string> }>();
    let psychologistsNotified = 0;

    for (const row of rows) {
      const phone = row.patient_phone as string;
      uniquePatients.add(phone);
      patientCounts.set(phone, (patientCounts.get(phone) ?? 0) + 1);

      if (row.psychologist_notified) psychologistsNotified += 1;

      const psychId = row.psychologist_id as string | null;
      if (psychId) {
        const stat = psychStats.get(psychId) ?? { messages: 0, patients: new Set<string>() };
        stat.messages += 1;
        stat.patients.add(phone);
        psychStats.set(psychId, stat);
      }
    }

    const repeatPatients = Array.from(patientCounts.values()).filter((c) => c > 1).length;

    const byPsychRaw = Array.from(psychStats.entries())
      .map(([psychologist_id, stat]) => ({
        psychologist_id,
        message_count: stat.messages,
        unique_patients: stat.patients.size,
      }))
      .sort((a, b) => b.message_count - a.message_count)
      .slice(0, 8);

    const by_psychologist = await enrichPsychologistNames(byPsychRaw);

    return {
      available: true,
      total_30d: rows.length,
      unique_patients_30d: uniquePatients.size,
      repeat_patients_30d: repeatPatients,
      psychologists_notified_30d: psychologistsNotified,
      by_psychologist,
    };
  } catch (error) {
    console.error('[operational-metrics] patient_inbound fetch failed', error);
    return empty;
  }
}

export async function fetchWhatsAppRoutingMetrics(
  supabase: SupabaseClient,
  sinceIso: string,
  patientRedirected: number,
): Promise<WhatsAppRoutingMetrics> {
  const fallback = emptyWhatsAppRoutingMetrics(patientRedirected);

  try {
    const kalyoBotId = process.env.KALYO_BOT_ID;
    if (!kalyoBotId) {
      return { ...fallback, kalyo_bot_configured: false };
    }

    const { count, error } = await supabase
      .from('messages')
      .select('id, conversations!inner(bot_id)', { count: 'exact', head: true })
      .eq('role', 'user')
      .eq('conversations.bot_id', kalyoBotId)
      .gte('created_at', sinceIso);

    if (error) {
      console.error('[operational-metrics] whatsapp_routing query failed', error);
      return fallback;
    }

    const sofiaUserMessages = count ?? 0;
    const total = patientRedirected + sofiaUserMessages;

    return {
      patient_redirected_30d: patientRedirected,
      sofia_user_messages_30d: sofiaUserMessages,
      redirect_rate_pct: pct(patientRedirected, total),
      kalyo_bot_configured: true,
    };
  } catch (error) {
    console.error('[operational-metrics] whatsapp_routing fetch failed', error);
    return fallback;
  }
}

async function fetchTrialDay8SurveyMetrics(
  supabase: SupabaseClient,
  sinceIso: string,
): Promise<TrialDay8SurveyMetrics> {
  const empty = emptyDay8SurveyMetrics();

  try {
    const { data: surveyRows, error } = await supabase
      .from('trial_onboarding_messages')
      .select('day_8_response')
      .gte('trial_started_at', sinceIso)
      .not('day_8_sent_at', 'is', null);

    if (error) {
      console.error('[operational-metrics] day8_survey query failed', error);
      return empty;
    }

    const sent = surveyRows?.length ?? 0;
    let responded = 0;
    const breakdown = { ...empty.breakdown };

    for (const row of surveyRows ?? []) {
      const key = row.day_8_response as Day8SurveyResponse | null;
      if (!key) continue;
      responded += 1;
      const label = DAY8_SURVEY_LABELS[key] ?? key;
      breakdown[label] = (breakdown[label] ?? 0) + 1;
    }

    return {
      sent_30d: sent,
      responded_30d: responded,
      pending_30d: sent - responded,
      response_rate_pct: pct(responded, sent),
      breakdown,
    };
  } catch (error) {
    console.error('[operational-metrics] day8_survey fetch failed', error);
    return empty;
  }
}

export async function fetchTrialOnboardingMetrics(
  supabase: SupabaseClient,
  sinceIso: string,
): Promise<TrialOnboardingMetrics> {
  const empty = emptyTrialOnboardingMetrics();

  try {
    const dripResult = await fetchBotioDripCounts(supabase, sinceIso).catch((error) => {
      console.error('[operational-metrics] trial drip counts failed', error);
      return null;
    });

    const [day8_survey, cohortResult] = await Promise.all([
      fetchTrialDay8SurveyMetrics(supabase, sinceIso),
      supabase
        .from('trial_onboarding_messages')
        .select('customer_responded, upgraded_to_paid_at, unsubscribed')
        .gte('trial_started_at', sinceIso),
    ]);

    if (cohortResult.error) {
      console.error('[operational-metrics] trial cohort query failed', cohortResult.error);
    }

    if (!dripResult) {
      return { ...empty, day8_survey };
    }

    const { counts } = dripResult;
    const cohort = cohortResult.data ?? [];
    const enrolled_30d = counts.total;
    const upgraded_30d = counts.paid_onboarding;
    const responded = cohort.filter((r) => r.customer_responded).length;
    const unsubscribed = cohort.filter((r) => r.unsubscribed).length;

    return {
      enrolled_30d,
      upgraded_30d,
      conversion_rate_pct: pct(upgraded_30d, enrolled_30d),
      response_rate_pct: pct(responded, enrolled_30d),
      unsubscribe_rate_pct: pct(unsubscribed, enrolled_30d),
      drip_funnel: buildDripFunnel(counts),
      day8_survey,
      day9_primer50_sent_30d: counts.day9,
    };
  } catch (error) {
    console.error('[operational-metrics] trial_onboarding fetch failed', error);
    return empty;
  }
}

async function fetchSofiaSalesMetricsSafe(
  kalyoLatest?: KalyoMetricRow | null,
  kalyoHistory?: KalyoMetricRow[],
): Promise<SofiaSalesMetrics> {
  try {
    return await fetchSofiaSalesMetrics(kalyoLatest ?? null, kalyoHistory ?? []);
  } catch (error) {
    console.error('[operational-metrics] sofia_sales fetch failed', error);
    return emptySofiaSalesMetrics();
  }
}

export async function fetchOperationalMetrics(
  kalyoLatest?: KalyoMetricRow | null,
  kalyoHistory?: KalyoMetricRow[],
): Promise<OperationalMetrics> {
  const empty = emptyOperationalMetrics();

  try {
    const supabase = createAdminClient();
    const sinceIso = subDays(new Date(), PERIOD_DAYS).toISOString();

    const patientInbound = await fetchPatientInboundMetrics(supabase, sinceIso);
    const [whatsappRouting, trialOnboarding, sofiaSales] = await Promise.all([
      fetchWhatsAppRoutingMetrics(supabase, sinceIso, patientInbound.total_30d),
      fetchTrialOnboardingMetrics(supabase, sinceIso),
      fetchSofiaSalesMetricsSafe(kalyoLatest, kalyoHistory),
    ]);

    return {
      patientInbound,
      whatsappRouting,
      trialOnboarding,
      sofiaSales,
    };
  } catch (error) {
    console.error('[operational-metrics] fetchOperationalMetrics failed', error);
    return empty;
  }
}
