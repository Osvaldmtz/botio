export type ConversationMessage = {
  role: string;
  content: string;
  created_at: string;
};

export type LeadEnrichmentInput = {
  phone: string;
  conversationMessages: ConversationMessage[];
  email?: string;
  name?: string;
};

export type LeadTemperature = 'cold' | 'warm' | 'hot';

export type EnrichedLead = {
  score: number;
  temperature: LeadTemperature;
  country: string;
  city?: string;
  timezone: string;
  signals: string[];
  intent: string;
  recommendedAction: string;
};

type CountryInfo = {
  country: string;
  timezone: string;
};

const COUNTRY_PREFIXES: Array<{ prefix: string; info: CountryInfo }> = [
  { prefix: '+593', info: { country: 'Ecuador', timezone: 'America/Guayaquil' } },
  { prefix: '+591', info: { country: 'Bolivia', timezone: 'America/La_Paz' } },
  { prefix: '+52', info: { country: 'México', timezone: 'America/Mexico_City' } },
  { prefix: '+57', info: { country: 'Colombia', timezone: 'America/Bogota' } },
  { prefix: '+54', info: { country: 'Argentina', timezone: 'America/Argentina/Buenos_Aires' } },
  { prefix: '+56', info: { country: 'Chile', timezone: 'America/Santiago' } },
  { prefix: '+51', info: { country: 'Perú', timezone: 'America/Lima' } },
  { prefix: '+58', info: { country: 'Venezuela', timezone: 'America/Caracas' } },
  { prefix: '+34', info: { country: 'España', timezone: 'Europe/Madrid' } },
  { prefix: '+1', info: { country: 'USA/Canadá', timezone: 'America/New_York' } },
];

const MEXICO_LADA_3: Record<string, string> = {
  '311': 'Tepic',
  '312': 'Colima',
  '442': 'Querétaro',
  '477': 'León',
};

const MEXICO_LADA_2: Record<string, string> = {
  '55': 'CDMX',
  '56': 'CDMX',
  '81': 'Monterrey',
  '33': 'Guadalajara',
  '22': 'Puebla',
  '99': 'Mérida',
  '64': 'Tijuana',
  '31': 'Aguascalientes',
  '44': 'San Luis Potosí / Querétaro',
};

const PRICE_RE =
  /precio|cu[aá]nto cuesta|cu[aá]nto vale|cu[aá]nto sale|cobran|valor|tarifa/i;
const PURCHASE_RE =
  /me ingresa|me apunto|lo tomo|lo contrato|quiero pagar|c[oó]mo pago|dale el link de pago|vamos|lo activo|quiero suscribirme|c[oó]mo me suscribo|c[oó]nde pago|quiero el plan pro|acepto|quiero comprarlo/i;
const HUMAN_RE =
  /human[oa]|asesor[a]?|(?:hablar|habla|quiero)\s+con\s+(?:alguien|una?\s+persona)|persona\b|agente\b/i;
const PATIENTS_RE = /(\d+)\s*pacientes?/i;
const URGENCY_RE = /urgente|ya|hoy|ahora|esta semana/i;
const TRIAL_RE = /trial|prueba\s+gratis|prueba\s+gratuita|demo|15\s*d[ií]as/i;
const PSYCHOLOGIST_RE =
  /psic[oó]log|terapeuta|cl[ií]nica|terapia|cedula profesional|c[eé]dula profesional|certificaci[oó]n/i;
const STUDENT_RE = /estudiante|universidad|facultad|maestr[ií]a en curso|carrera de psicolog/i;
const COMPETITOR_RE = /heiko|assessmentmind|psiris|elo\b/i;
const POSITIVE_KALYO_RE = /prefiero kalyo|mejor que|kalyo es mejor|me quedo con kalyo/i;
const FEATURE_RE =
  /evaluaci[oó]n|transcripci[oó]n|soap|kalyo meet|videollamada|notas soap/i;
const DISCOUNT_RE = /descuento|beca|estudiante/i;
const CERTIFIED_RE = /c[eé]dula profesional|certificaci[oó]n profesional|psic[oó]logo certificado/i;
const ADOLESCENTS_RE = /adolescentes?|ni[nñ]os?|j[oó]venes?|menores/i;
const ONLINE_RE = /videollamada|telesalud|online|remoto|virtual/i;
const PRO_RE = /\bpro\b|plan pro|reportes? con ia|interpretaci[oó]n por ia/i;
const MAX_RE = /\bmax\b|plan max|agenda de citas|finanzas|portal del paciente/i;
const VOCATIONAL_RE = /vocacional|orientaci[oó]n de carrera|orientaci[oó]n vocacional/i;
const SUPPORT_RE = /mi cuenta|no puedo entrar|error en|problema con|soporte|no funciona/i;
const DEMO_RE = /demo personalizada|demostraci[oó]n personalizada|agendar demo/i;

export function getCountryFromPhone(phone: string): CountryInfo {
  const normalized = phone.trim();
  for (const { prefix, info } of COUNTRY_PREFIXES) {
    if (normalized.startsWith(prefix)) return info;
  }
  return { country: 'Otro', timezone: 'America/Mexico_City' };
}

export function getMexicoCityFromPhone(phone: string): string | undefined {
  const digits = phone.replace(/\D/g, '');
  if (!digits.startsWith('52')) return undefined;

  let national = digits.slice(2);
  if (national.startsWith('1') && national.length >= 11) {
    national = national.slice(1);
  }

  const lada3 = national.slice(0, 3);
  if (MEXICO_LADA_3[lada3]) return MEXICO_LADA_3[lada3];

  const lada2 = national.slice(0, 2);
  return MEXICO_LADA_2[lada2];
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

function temperatureFromScore(score: number): LeadTemperature {
  if (score >= 70) return 'hot';
  if (score >= 40) return 'warm';
  return 'cold';
}

function isFullName(name: string | undefined): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (/^yo$/i.test(trimmed)) return false;
  if (!trimmed.includes(' ') && trimmed.length < 8) return false;
  return trimmed.includes(' ') || trimmed.split(/\s+/).length >= 2;
}

function userMessages(messages: ConversationMessage[]): ConversationMessage[] {
  return messages.filter((m) => m.role === 'user');
}

function allUserText(messages: ConversationMessage[]): string {
  return userMessages(messages)
    .map((m) => m.content)
    .join('\n');
}

const EMBAJADOR_RE =
  /embajador|programa de afiliados|afiliad[oa]|webinar|comisi[oó]n|ingreso extra|ganar dinero/i;

function detectIntent(text: string): string {
  if (isAmbassadorFlowsEnabled() && EMBAJADOR_RE.test(text)) return 'Embajadores';
  if (SUPPORT_RE.test(text)) return 'Soporte';
  if (DEMO_RE.test(text)) return 'Demo';
  if (VOCATIONAL_RE.test(text)) return 'Vocacional';
  if (MAX_RE.test(text)) return 'Plan Max';
  if (PRO_RE.test(text)) return 'Plan Pro';
  if (TRIAL_RE.test(text)) return 'Trial';
  return 'Información general';
}

function detectSignals(
  text: string,
  email: string | undefined,
  userMsgCount: number,
): string[] {
  const signals: string[] = [];

  if (PRICE_RE.test(text)) signals.push('preguntó precio');
  const patients = text.match(PATIENTS_RE);
  if (patients) signals.push(`mencionó ${patients[1]} pacientes`);
  if (email) signals.push('dio email');
  if (TRIAL_RE.test(text)) signals.push('preguntó por trial');
  if (URGENCY_RE.test(text)) signals.push('mencionó urgencia');
  if (COMPETITOR_RE.test(text)) signals.push('comparó con competencia');
  if (/evaluaci[oó]n|tests?|pruebas? cl[ií]nicas/i.test(text)) {
    signals.push('preguntó por evaluaciones');
  }
  if (/soap|notas soap/i.test(text)) signals.push('preguntó por SOAP');
  if (DISCOUNT_RE.test(text)) signals.push('preguntó por descuentos');
  if (CERTIFIED_RE.test(text)) signals.push('es psicólogo certificado');
  if (ADOLESCENTS_RE.test(text)) signals.push('trabaja con adolescentes');
  if (ONLINE_RE.test(text)) signals.push('trabaja online');
  if (userMsgCount > 5) signals.push(`conversación larga (${userMsgCount} mensajes)`);

  return signals;
}

function recommendedActionFromScore(score: number): string {
  if (score >= 80) return '🔥 Contactar AHORA — lead muy caliente';
  if (score >= 70) return '🔥 Contactar en próximas 2 horas';
  if (score >= 50) return '📞 Contactar hoy mismo';
  if (score >= 30) return '📨 Follow-up automático en 24h';
  return '❄️ Lead frío — descartar o nurturing';
}

import type { SupabaseClient } from '@supabase/supabase-js';
import { isAmbassadorConversation, isAmbassadorFlowsEnabled } from '@/lib/ambassador-filters';
import { notifyHotLeadIfNew } from '@/lib/hot-lead-notifier';

export function enrichLead(input: LeadEnrichmentInput): EnrichedLead {
  const text = allUserText(input.conversationMessages);
  const userMsgCount = userMessages(input.conversationMessages).length;
  const { country, timezone } = getCountryFromPhone(input.phone);

  let score = 30;

  if (input.email) score += 15;
  if (isFullName(input.name)) score += 10;
  if (PRICE_RE.test(text)) score += 10;
  if (PURCHASE_RE.test(text)) score += 10;
  if (HUMAN_RE.test(text)) score += 8;
  if (PATIENTS_RE.test(text)) score += 7;
  if (FEATURE_RE.test(text)) score += 5;
  if (userMsgCount > 5) score += 5;
  if (URGENCY_RE.test(text)) score += 5;
  if (TRIAL_RE.test(text)) score += 5;
  if (PSYCHOLOGIST_RE.test(text)) score += 5;

  if (STUDENT_RE.test(text)) score -= 10;
  if (COMPETITOR_RE.test(text) && !POSITIVE_KALYO_RE.test(text)) score -= 5;

  score = clampScore(score);

  const city = country === 'México' ? getMexicoCityFromPhone(input.phone) : undefined;
  const signals = detectSignals(text, input.email, userMsgCount);
  const intent = detectIntent(text);
  const temperature = temperatureFromScore(score);

  return {
    score,
    temperature,
    country,
    city,
    timezone,
    signals,
    intent,
    recommendedAction: recommendedActionFromScore(score),
  };
}

async function countMessagesForConversation(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversationId);

  if (error) {
    console.error('[lead-enrichment] message count failed', { conversationId, error });
    return 0;
  }

  return count ?? 0;
}

export async function enrichAndNotifyLead(
  supabase: SupabaseClient,
  params: {
    conversationId: string;
    phone: string;
    conversationMessages: ConversationMessage[];
    email?: string;
    name?: string;
  },
): Promise<EnrichedLead> {
  const { data: convRow } = await supabase
    .from('conversations')
    .select('lead_signals, customer_phone, lead_score, channel, session_id, is_ambassador, is_team_member, metadata')
    .eq('id', params.conversationId)
    .maybeSingle();

  if (
    convRow?.is_team_member === true ||
    (convRow &&
      isAmbassadorConversation({
        is_ambassador: convRow.is_ambassador,
        metadata: convRow.metadata as Record<string, unknown> | null,
      }))
  ) {
    console.log(
      `[lead-enrichment] skip | reason=${convRow?.is_team_member ? 'is_team_member' : 'is_ambassador'} | conv=${params.conversationId}`,
    );
    return enrichLead({
      phone: params.phone,
      conversationMessages: params.conversationMessages,
      email: params.email,
      name: params.name,
    });
  }

  const previousScore = convRow?.lead_score ?? 0;

  const enriched = enrichLead({
    phone: params.phone,
    conversationMessages: params.conversationMessages,
    email: params.email,
    name: params.name,
  });

  const messageCount = await countMessagesForConversation(supabase, params.conversationId);
  if (messageCount === 0 && process.env.NODE_ENV === 'production') {
    console.warn(
      `[lead-enrichment] skip persist | conv=${params.conversationId} | reason=no_messages_in_db`,
    );
    return enriched;
  }

  const existingSignals = Array.isArray(convRow?.lead_signals)
    ? (convRow.lead_signals as string[])
    : [];
  const hotAlertSignals = existingSignals.filter((s) => s.startsWith('hot_alert:'));
  const mergedSignals = [...enriched.signals, ...hotAlertSignals];

  const { error: updateError } = await supabase
    .from('conversations')
    .update({
      lead_score: enriched.score,
      lead_temperature: enriched.temperature,
      lead_country: enriched.country,
      lead_city: enriched.city ?? null,
      lead_intent: enriched.intent,
      lead_signals: mergedSignals,
      enriched_at: new Date().toISOString(),
    })
    .eq('id', params.conversationId);

  if (updateError) {
    console.error('[lead-enrichment] persist failed', updateError);
  }

  if (enriched.score >= 70) {
    await notifyHotLeadIfNew({
      supabase,
      conversation: {
        id: params.conversationId,
        customer_phone: params.phone,
        channel: convRow?.channel ?? null,
        session_id: convRow?.session_id ?? null,
        lead_signals: mergedSignals,
      },
      enrichment: enriched,
      previousScore,
      messages: params.conversationMessages,
      name: params.name,
      email: params.email,
    });
  }

  return enriched;
}
