export type ProfileMessage = {
  role: string;
  content: string;
};

export type ProfileType =
  | 'private_practice'
  | 'clinic_team'
  | 'student'
  | 'institution_decision_maker'
  | 'unknown';

const PROFILE_PATTERNS: Array<{ profile: ProfileType; re: RegExp }> = [
  {
    profile: 'institution_decision_maker',
    re: /director|coordinador|jefe de|fundador|institucion|decisi[oó]n de compra|necesito presupuesto/i,
  },
  {
    profile: 'clinic_team',
    re: /cl[ií]nica|hospital|equipo de|somos varios|psic[oó]logos en|mis colegas/i,
  },
  {
    profile: 'private_practice',
    re: /consulta privada|trabajo solo|mis pacientes|mi pr[áa]ctica|atiendo|tengo \d+ pacientes/i,
  },
  {
    profile: 'student',
    re: /estudiante|tesis|practicante|pasante|universidad|todav[ií]a no atiendo|no tengo c[eé]dula/i,
  },
];

const PRIORITY: ProfileType[] = [
  'institution_decision_maker',
  'clinic_team',
  'private_practice',
  'student',
];

export function detectPsychologistProfile(messages: ProfileMessage[]): ProfileType {
  const text = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join('\n');

  if (!text.trim()) return 'unknown';

  const matched = new Set<ProfileType>();
  for (const { profile, re } of PROFILE_PATTERNS) {
    if (re.test(text)) matched.add(profile);
  }

  if (matched.size === 0) return 'unknown';

  for (const profile of PRIORITY) {
    if (matched.has(profile)) return profile;
  }

  return 'unknown';
}
