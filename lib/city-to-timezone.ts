import { CITY_TIMEZONE_ENTRIES, type CityTimezoneEntry } from '@/lib/city-timezone-data';

export type TimezoneMatch = {
  timezone: string;
  city_normalized: string;
  country: string;
  label: string;
  utc_offset: string;
  confidence: 'high' | 'medium' | 'low';
};

type AliasIndexEntry = {
  alias: string;
  entry: CityTimezoneEntry;
};

const ALIAS_INDEX: AliasIndexEntry[] = CITY_TIMEZONE_ENTRIES.flatMap((entry) =>
  entry.aliases.map((alias) => ({ alias: normalizeCityText(alias), entry })),
);

function normalizeCityText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCase(text: string): string {
  return text
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}

function getUtcOffset(timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    });
    const parts = formatter.formatToParts(new Date());
    const offset = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
    return offset.replace('GMT', 'UTC');
  } catch {
    return 'UTC';
  }
}

function toMatch(
  entry: CityTimezoneEntry,
  matchedAlias: string,
  confidence: TimezoneMatch['confidence'],
): TimezoneMatch {
  return {
    timezone: entry.timezone,
    city_normalized: titleCase(matchedAlias),
    country: entry.country,
    label: entry.label,
    utc_offset: getUtcOffset(entry.timezone),
    confidence,
  };
}

export function cityToTimezone(cityText: string): TimezoneMatch | null {
  const normalized = normalizeCityText(cityText);
  if (!normalized || normalized.length < 2) return null;

  for (const { alias, entry } of ALIAS_INDEX) {
    if (normalized === alias) {
      return toMatch(entry, alias, 'high');
    }
  }

  for (const { alias, entry } of ALIAS_INDEX) {
    if (normalized.length < 5 || alias.length < 5) continue;
    if (!alias.includes(normalized) && !normalized.includes(alias)) continue;
    if (Math.abs(normalized.length - alias.length) > 1) continue;
    return toMatch(entry, alias, 'medium');
  }

  // Fuzzy only for longer inputs; low-confidence matches are rejected (return null).
  if (normalized.length >= 7) {
    let best: { entry: CityTimezoneEntry; alias: string; distance: number } | null = null;
    for (const { alias, entry } of ALIAS_INDEX) {
      const distance = levenshteinDistance(normalized, alias);
      if (distance > 2) continue;
      if (!best || distance < best.distance) {
        best = { entry, alias, distance };
      }
    }
    if (best) {
      void toMatch(best.entry, best.alias, 'low');
    }
  }

  return null;
}
