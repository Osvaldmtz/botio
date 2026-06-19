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

  // Client psychologist signals override broad ambassador patterns (e.g. "webinar" alone)
  if (isLikelyClientPsychologist(normalized)) return null;

  for (const pattern of AMBASSADOR_PATTERNS) {
    if (pattern.test(normalized)) {
      return 'embajador_program';
    }
  }

  return null;
}

const CLIENT_PSYCHOLOGIST_SIGNALS: RegExp[] = [
  /\bpsic[óo]log[oa]s?\b/i,
  /\bpacientes?\b/i,
  /\b(plan|planes)\b.*\b(precio|costo|cu[áa]nto)\b/i,
  /\b(precio|precios|costo|cu[áa]nto)\s+(cuesta|vale|del?\s+plan)/i,
  /\bevaluaciones?\s+(cl[íi]nica|psicol[óo]gica)/i,
  /\bnormativa\b/i,
  /\bSIVIGILA\b/i,
  /\bICD[\-\s]?10\b/i,
  /\bDSM[\-\s]?5/i,
  /\bnotas?\s+SOAP\b/i,
  /\bexpediente\s+cl[íi]nico\b/i,
  /\bagenda\s+(de\s+)?citas?\b/i,
  /\bhistoria\s+cl[íi]nica\b/i,
];

export function isLikelyClientPsychologist(message: string): boolean {
  return CLIENT_PSYCHOLOGIST_SIGNALS.some((p) => p.test(message));
}
