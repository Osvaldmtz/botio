import type { TrialAcquisitionRow } from '@/lib/trial-acquisition-types';

export const DIRECT_UNKNOWN_CHANNEL = 'directo / desconocido';

type PsychologistAttributionRow = {
  attribution: unknown;
  attribution_source?: string | null;
  created_at: string;
};

export function formatAcquisitionChannel(
  attribution: unknown,
  attributionSource?: string | null,
): string {
  const label = attributionSource?.trim();
  if (label) return label.toLowerCase();

  if (attribution == null) return DIRECT_UNKNOWN_CHANNEL;

  if (typeof attribution !== 'object' || Array.isArray(attribution)) {
    return DIRECT_UNKNOWN_CHANNEL;
  }

  const record = attribution as Record<string, unknown>;
  const nested =
    typeof record.attribution_source === 'string'
      ? record.attribution_source.trim()
      : '';
  if (nested) return nested.toLowerCase();

  const rawSource = typeof record.utm_source === 'string' ? record.utm_source.trim() : '';
  const rawMedium = typeof record.utm_medium === 'string' ? record.utm_medium.trim() : '';

  if (!rawSource && !rawMedium) return DIRECT_UNKNOWN_CHANNEL;

  const source = rawSource ? rawSource.toLowerCase() : 'directo';
  const medium = rawMedium ? rawMedium.toLowerCase() : 'desconocido';
  return `${source} / ${medium}`;
}

export function aggregateTrialsByChannel(
  rows: PsychologistAttributionRow[],
): TrialAcquisitionRow[] {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const channel = formatAcquisitionChannel(row.attribution, row.attribution_source);
    counts.set(channel, (counts.get(channel) ?? 0) + 1);
  }

  const total = rows.length;
  if (total === 0) return [];

  return Array.from(counts.entries())
    .map(([channel, trials]) => ({
      channel,
      trials,
      pct: Math.round((trials / total) * 1000) / 10,
    }))
    .sort((a, b) => b.trials - a.trials || a.channel.localeCompare(b.channel, 'es'));
}
