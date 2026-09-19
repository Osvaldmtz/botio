/**
 * Detect customer IANA timezone from WhatsApp/phone country calling code.
 * Used for demo slot labels — never for manual hour arithmetic (date-fns-tz does that).
 *
 * México (UTC-6 year-round since 2022; no DST).
 * Fallback: America/Bogota.
 */

export const DEFAULT_CUSTOMER_TIMEZONE = 'America/Bogota';
export const DEFAULT_CUSTOMER_TIMEZONE_LABEL = 'Bogotá';

type PhoneTimezoneRule = {
  /** E.164 country calling codes, longest first when matching. */
  prefixes: string[];
  timezone: string;
  label: string;
};

const PHONE_TIMEZONE_RULES: PhoneTimezoneRule[] = [
  { prefixes: ['+593'], timezone: 'America/Guayaquil', label: 'Guayaquil' },
  { prefixes: ['+52'], timezone: 'America/Mexico_City', label: 'CDMX' },
  { prefixes: ['+57'], timezone: 'America/Bogota', label: 'Bogotá' },
  { prefixes: ['+51'], timezone: 'America/Lima', label: 'Lima' },
  { prefixes: ['+58'], timezone: 'America/Caracas', label: 'Caracas' },
  { prefixes: ['+54'], timezone: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires' },
  { prefixes: ['+56'], timezone: 'America/Santiago', label: 'Santiago' },
  { prefixes: ['+1'], timezone: 'America/Mexico_City', label: 'CDMX' },
];

/** @deprecated Prefer string; kept for call-site compatibility. */
export type CustomerTimezone = string;
/** @deprecated Prefer string; kept for call-site compatibility. */
export type CustomerTimezoneLabel = string;

export function normalizePhoneForTimezone(phone: string | undefined | null): string {
  return (phone ?? '')
    .trim()
    .replace(/^whatsapp:/i, '')
    .replace(/[\s()-]/g, '');
}

function matchPhoneTimezoneRule(
  phone: string | undefined | null,
): PhoneTimezoneRule | null {
  const normalized = normalizePhoneForTimezone(phone);
  if (!normalized) return null;

  const withPlus = normalized.startsWith('+') ? normalized : `+${normalized}`;

  const sorted = [...PHONE_TIMEZONE_RULES].sort(
    (a, b) =>
      Math.max(...b.prefixes.map((p) => p.length)) -
      Math.max(...a.prefixes.map((p) => p.length)),
  );

  for (const rule of sorted) {
    if (rule.prefixes.some((prefix) => withPlus.startsWith(prefix))) {
      return rule;
    }
  }
  return null;
}

export function getCustomerTimezone(phone: string | undefined | null): string {
  return matchPhoneTimezoneRule(phone)?.timezone ?? DEFAULT_CUSTOMER_TIMEZONE;
}

export function getCustomerTimezoneLabel(phone: string | undefined | null): string {
  return matchPhoneTimezoneRule(phone)?.label ?? DEFAULT_CUSTOMER_TIMEZONE_LABEL;
}

export function resolvePhoneTimezone(phone: string | undefined | null): {
  timezone: string;
  label: string;
} {
  const rule = matchPhoneTimezoneRule(phone);
  return {
    timezone: rule?.timezone ?? DEFAULT_CUSTOMER_TIMEZONE,
    label: rule?.label ?? DEFAULT_CUSTOMER_TIMEZONE_LABEL,
  };
}
