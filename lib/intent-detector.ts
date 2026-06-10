export type AmbassadorIntent = 'embajador_program' | null;

const AMBASSADOR_PATTERNS: RegExp[] = [
  /\bembajador(?:es)?\b/i,
  /\bganar\s+(?:dinero|comisi[oó]n(?:es)?)\b/i,
  /\bprograma\s+de\s+(?:afiliados?|embajadores?)\b/i,
  /\bafiliad[oa]s?\b/i,
  /\bvi\s+(?:el|tu)\s+anuncio\b/i,
  /\bvi\s+(?:el|tu)\s+anuncio\b.*\bestudiante/i,
  /\bestudiante\b.*\bvi\s+(?:el|tu)\s+anuncio/i,
  /\bestudiante\s+de\s+psicolog[ií]a\b/i,
  /\brecomendar\s+kalyo\b/i,
  /\breferir\s+psic[oó]logos?\b/i,
  /\bestudiante\s+de\s+psicolog[ií]a\b.*\btrabaj/i,
  /\btrabaj\w*\b.*\bestudiante\s+de\s+psicolog[ií]a/i,
  /\bwebinar\b/i,
  /\bcomisi[oó]n(?:es)?\b/i,
  /\bingreso\s+extra\b/i,
  /\bembajadores?\s+kalyo\b/i,
  /\bluma\.com\b/i,
];

export function detectAmbassadorIntent(text: string): AmbassadorIntent {
  const normalized = text.trim();
  if (!normalized) return null;

  for (const pattern of AMBASSADOR_PATTERNS) {
    if (pattern.test(normalized)) {
      return 'embajador_program';
    }
  }

  return null;
}
