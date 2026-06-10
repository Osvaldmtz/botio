import type { SupabaseClient } from '@supabase/supabase-js';

export type ObjectionType =
  | 'price'
  | 'thinking'
  | 'competition'
  | 'no_time'
  | 'not_useful'
  | 'few_patients';

export type ObjectionConfidence = 'high' | 'medium' | 'low';

export type ObjectionMatch = {
  type: ObjectionType;
  confidence: ObjectionConfidence;
  trigger_phrase: string;
  is_repeat: boolean;
};

export type ObjectionConversation = {
  id: string;
  customer_phone: string;
};

type PatternRule = {
  type: ObjectionType;
  regex: RegExp;
  confidence: ObjectionConfidence;
};

const PRIORITY: ObjectionType[] = [
  'price',
  'competition',
  'thinking',
  'no_time',
  'not_useful',
  'few_patients',
];

const PATTERNS: PatternRule[] = [
  { type: 'price', regex: /(?:es|esta|está|me parece|son)\s*(?:muy\s*|demasiado\s*)?caro/i, confidence: 'high' },
  {
    type: 'price',
    regex: /sigue\s*(?:siendo\s*)?(?:muy\s*|demasiado\s*)?caro/i,
    confidence: 'high',
  },
  {
    type: 'price',
    regex: /(?:todavia|aun|aún)\s*(?:es\s*)?(?:muy\s*|demasiado\s*)?caro/i,
    confidence: 'high',
  },
  { type: 'price', regex: /(?:me\s*)?sigue\s*pareciendo\s*caro/i, confidence: 'high' },
  { type: 'price', regex: /\bcaro\s+para\s+m[ií]\b/i, confidence: 'high' },
  { type: 'price', regex: /no\s*(?:tengo|cuento\s*con)\s*(?:el\s*)?(?:presupuesto|dinero|lana|plata)/i, confidence: 'high' },
  { type: 'price', regex: /(?:fuera|arriba)\s*de\s*mi\s*(?:rango|presupuesto)/i, confidence: 'high' },
  { type: 'price', regex: /(?:precio|costo)\s*(?:alto|elevado|caro)/i, confidence: 'medium' },
  {
    type: 'thinking',
    regex: /(?:lo\s*voy\s*a|dejame|déjame|me\s*lo\s*voy\s*a)\s*pensar/i,
    confidence: 'high',
  },
  {
    type: 'thinking',
    regex: /(?:luego|despues|después|mas\s*tarde|más\s*tarde)\s*te\s*(?:respondo|digo|aviso)/i,
    confidence: 'high',
  },
  { type: 'thinking', regex: /lo\s*(?:consulto|platico|hablo)\s*con/i, confidence: 'medium' },
  { type: 'thinking', regex: /tengo\s*que\s*pensarlo/i, confidence: 'high' },
  { type: 'thinking', regex: /(?:me|me\s*lo)\s*comento/i, confidence: 'medium' },
  {
    type: 'competition',
    regex:
      /(?:ya\s*)?(?:tengo|uso|trabajo\s*con)\s*(?:otro|el|un|una)?\s*(?:sistema|software|plataforma|app|programa)/i,
    confidence: 'high',
  },
  {
    type: 'competition',
    regex:
      /(?:doctoralia|psicologia|medical|cliniweb|patient|sermed|psicoanalisisol|holmedi)/i,
    confidence: 'high',
  },
  { type: 'competition', regex: /uso\s*(?:un\s*)?excel/i, confidence: 'high' },
  {
    type: 'competition',
    regex:
      /(?:trabajo|llevo)\s*(?:los\s*)?(?:expedientes|registros|notas)\s*(?:en|con)\s*(?:papel|word|excel)/i,
    confidence: 'high',
  },
  {
    type: 'competition',
    regex: /tengo\s*(?:mi|mis)\s*(?:propio|propios)\s*(?:sistema|registros)/i,
    confidence: 'medium',
  },
  {
    type: 'no_time',
    regex: /(?:ahorita|ahora|en\s*este\s*momento)\s*no\s*(?:tengo|puedo)/i,
    confidence: 'high',
  },
  { type: 'no_time', regex: /estoy\s*(?:muy\s*)?ocupad[oa]/i, confidence: 'high' },
  { type: 'no_time', regex: /no\s*es\s*(?:el\s*)?momento/i, confidence: 'medium' },
  {
    type: 'no_time',
    regex: /(?:despues|después|luego)\s*(?:cuando|te\s*vuelvo)/i,
    confidence: 'medium',
  },
  { type: 'no_time', regex: /no\s*tengo\s*tiempo/i, confidence: 'high' },
  {
    type: 'not_useful',
    regex: /no\s*(?:creo|pienso)\s*que\s*me\s*(?:sirva|funcione|aplique)/i,
    confidence: 'high',
  },
  {
    type: 'not_useful',
    regex: /no\s*es\s*lo\s*que\s*(?:busco|necesito)/i,
    confidence: 'high',
  },
  { type: 'not_useful', regex: /no\s*(?:me\s*)?aplica/i, confidence: 'medium' },
  {
    type: 'not_useful',
    regex: /no\s*(?:es|me)\s*(?:para\s*m[ií]|conveniente)/i,
    confidence: 'medium',
  },
  { type: 'few_patients', regex: /tengo\s*pocos\s*pacientes/i, confidence: 'high' },
  {
    type: 'few_patients',
    regex: /(?:apenas|recien|recién)\s*(?:empiezo|empezando|estoy\s*empezando|comenzando)/i,
    confidence: 'high',
  },
  { type: 'few_patients', regex: /soy\s*(?:nuev[oa]|principiante|reciente)/i, confidence: 'medium' },
  {
    type: 'few_patients',
    regex: /(?:no\s*tengo|son\s*pocos\s*mis)\s*pacientes/i,
    confidence: 'high',
  },
  {
    type: 'few_patients',
    regex: /(?:1|2|3|uno|dos|tres|pocos)\s*pacientes/i,
    confidence: 'medium',
  },
];

export function normalizeObjectionText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function matchPriceDollars(normalized: string): ObjectionMatch | null {
  const hasAmount = /(?:29|39|veintinueve|treinta\s*y\s*nueve)\s*(?:dolares|dolar|usd)/i.test(
    normalized,
  );
  const hasMuch = /(?:es|son)\s*much[oa]s?|mucho\s*dinero/i.test(normalized);
  if (hasAmount && hasMuch) {
    return {
      type: 'price',
      confidence: 'high',
      trigger_phrase: normalized.slice(0, 80),
      is_repeat: false,
    };
  }
  return null;
}

export function matchObjectionPattern(messageBody: string): Omit<ObjectionMatch, 'is_repeat'> | null {
  const normalized = normalizeObjectionText(messageBody);
  if (!normalized) return null;

  const dollarMatch = matchPriceDollars(normalized);
  if (dollarMatch) {
    return {
      type: dollarMatch.type,
      confidence: dollarMatch.confidence,
      trigger_phrase: dollarMatch.trigger_phrase,
    };
  }

  const matches: Array<Omit<ObjectionMatch, 'is_repeat'>> = [];

  for (const rule of PATTERNS) {
    const m = normalized.match(rule.regex);
    if (m) {
      matches.push({
        type: rule.type,
        confidence: rule.confidence,
        trigger_phrase: m[0],
      });
    }
  }

  if (matches.length === 0) return null;

  for (const type of PRIORITY) {
    const found = matches.find((m) => m.type === type);
    if (found) return found;
  }

  return matches[0];
}

async function countPriorObjections(
  supabase: SupabaseClient,
  conversationId: string,
  type: ObjectionType,
): Promise<number> {
  const { count, error } = await supabase
    .from('detected_objections')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversationId)
    .eq('objection_type', type);

  if (error) throw error;
  return count ?? 0;
}

export async function detectObjection(
  messageBody: string,
  conversation: ObjectionConversation,
  supabase: SupabaseClient,
): Promise<ObjectionMatch | null> {
  const { data: convRow } = await supabase
    .from('conversations')
    .select('is_ambassador, metadata')
    .eq('id', conversation.id)
    .maybeSingle();

  if (
    convRow?.is_ambassador === true ||
    (convRow?.metadata as Record<string, unknown> | null)?.is_ambassador_lead === true
  ) {
    return null;
  }

  const normalized = normalizeObjectionText(messageBody);
  const priorPriceCount = await countPriorObjections(supabase, conversation.id, 'price');

  if (priorPriceCount > 0 && /\bcaro\b/.test(normalized)) {
    return {
      type: 'price',
      confidence: 'high',
      trigger_phrase: normalized.match(/\bcaro\b[^.!?]*/)?.[0] ?? 'caro',
      is_repeat: true,
    };
  }

  const pattern = matchObjectionPattern(messageBody);
  if (!pattern) return null;

  const priorCount = await countPriorObjections(supabase, conversation.id, pattern.type);

  return {
    ...pattern,
    is_repeat: priorCount > 0,
  };
}
