import 'server-only';

/** Assistant sources excluded from engagement / daily message metrics. */
const EXACT_AUTOMATED_SOURCES = new Set([
  'trial_onboarding',
  'trial_onboarding_welcome',
  'objection_followup',
  'ghost-reactivation',
  'lead_followup',
  'ambassador_handler',
  'ambassador_faq',
  'ambassador_guard',
]);

const PREFIX_AUTOMATED_SOURCES = ['trial_onboarding_day_', 'demo_reminder_'] as const;

export function resolveMessageMetricSource(message: {
  source?: string | null;
  metadata?: Record<string, unknown> | null;
}): string {
  const fromMeta = message.metadata?.source;
  if (typeof fromMeta === 'string' && fromMeta.trim()) return fromMeta.trim();
  if (typeof message.source === 'string' && message.source.trim()) return message.source.trim();
  return '';
}

export function isAutomatedMetricMessage(message: {
  role: string;
  source?: string | null;
  metadata?: Record<string, unknown> | null;
}): boolean {
  if (message.role !== 'assistant') return false;

  const source = resolveMessageMetricSource(message);
  if (!source) return false;

  if (EXACT_AUTOMATED_SOURCES.has(source)) return true;
  return PREFIX_AUTOMATED_SOURCES.some((prefix) => source.startsWith(prefix));
}

export function isEngagementMetricMessage(message: {
  role: string;
  source?: string | null;
  metadata?: Record<string, unknown> | null;
}): boolean {
  return !isAutomatedMetricMessage(message);
}
