export const KALYO_TRIAL_DAYS = 7;
export const KALYO_TRIAL_MS = KALYO_TRIAL_DAYS * 24 * 60 * 60 * 1000;

/** Max trial — maps to Kalyo `professional` plan enum. */
export const KALYO_TRIAL_PLAN_MAX = 'professional';
/** Pro trial (explicit opt-in only) — maps to Kalyo `starter` plan enum. */
export const KALYO_TRIAL_PLAN_PRO = 'starter';

export type TrialPlanChoice = 'max' | 'pro';

export function resolveTrialDbPlan(choice?: TrialPlanChoice | string | null): string {
  if (choice === 'pro') return KALYO_TRIAL_PLAN_PRO;
  return KALYO_TRIAL_PLAN_MAX;
}

export function trialPlanLabel(choice?: TrialPlanChoice | string | null): string {
  return choice === 'pro' ? 'Pro' : 'Max';
}

export const TRIAL_MAX_FEATURE_BULLETS = [
  'Agenda + Kalyo Meet',
  'Grabación y transcripción',
  'Portal del paciente',
  'Kaly voz + todo lo de Pro',
] as const;

export function detectTrialPlanPreference(message: string): TrialPlanChoice {
  const text = message.trim().toLowerCase();
  if (
    /\b(?:trial|prueba)\s+(?:de\s+)?pro\b/.test(text) ||
    /\bpro\s+(?:trial|prueba)\b/.test(text) ||
    /\b(?:quiero|prefiero|solo)\s+(?:el\s+)?(?:trial\s+)?pro\b/.test(text) ||
    /\bactiva(?:me)?\s+(?:el\s+)?trial\s+pro\b/.test(text)
  ) {
    return 'pro';
  }
  return 'max';
}

export const KALYO_TRIAL_PLAN_VALUES = [KALYO_TRIAL_PLAN_MAX, KALYO_TRIAL_PLAN_PRO] as const;
