export type DemoPhoneCheck =
  | { ok: true; e164: string; normalized: boolean }
  | { ok: false; reason: 'empty' | 'invalid' | 'invalid_chile' | 'lookup'; message: string };

const CHILE_MOBILE = /^\+569\d{8}$/;
const CHILE_DUPLICATE_COUNTRY = /^\+5656(9\d{8})$/;
const E164 = /^\+[1-9]\d{7,14}$/;

export const DEMO_PHONE_CORRECTION =
  'Ese número de WhatsApp no es válido. Escríbelo con código de país, por ejemplo +57 300 123 4567 o, en Chile, +56 9 y 8 dígitos.';

export const DEMO_PHONE_CHILE_CORRECTION =
  'Ese número de Chile no es un móvil válido. El formato es +56 9 y 8 dígitos, por ejemplo +56 9 1234 5678. +56 56 … tiene el código de país repetido.';

export function normalizeDemoPhone(raw: string | null | undefined): string {
  let value = (raw ?? '')
    .trim()
    .replace(/^whatsapp:/i, '')
    .replace(/[\s()-]/g, '');
  if (value.startsWith('00')) value = `+${value.slice(2)}`;
  if (/^\d+$/.test(value)) value = `+${value}`;
  return value;
}

function chileCorrection(duplicatedNational: string | null): string {
  if (!duplicatedNational) return DEMO_PHONE_CHILE_CORRECTION;
  const pretty = `+56 ${duplicatedNational.slice(0, 1)} ${duplicatedNational.slice(1, 5)} ${duplicatedNational.slice(5)}`;
  return `Ese número repite el código +56. ¿Quisiste decir ${pretty}? Escríbelo así para agendar.`;
}

export function validateDemoPhoneFormat(raw: string | null | undefined): DemoPhoneCheck {
  const original = (raw ?? '').trim();
  if (!original) {
    return { ok: false, reason: 'empty', message: DEMO_PHONE_CORRECTION };
  }
  const e164 = normalizeDemoPhone(original);
  const duplicated = e164.match(CHILE_DUPLICATE_COUNTRY);
  if (duplicated) {
    return {
      ok: false,
      reason: 'invalid_chile',
      message: chileCorrection(duplicated[1] ?? null),
    };
  }
  if (e164.startsWith('+56') && !CHILE_MOBILE.test(e164)) {
    return { ok: false, reason: 'invalid_chile', message: DEMO_PHONE_CHILE_CORRECTION };
  }
  if (!E164.test(e164)) {
    return { ok: false, reason: 'invalid', message: DEMO_PHONE_CORRECTION };
  }
  const compactOriginal = original.replace(/^whatsapp:/i, '').replace(/[\s()-]/g, '');
  const originalE164 = compactOriginal.startsWith('+') ? compactOriginal : `+${compactOriginal}`;
  return { ok: true, e164, normalized: e164 !== originalE164 };
}

export type LookupPhoneResult = { valid: boolean } | { skipped: true };

export function combineDemoPhoneChecks(
  format: DemoPhoneCheck,
  lookup: LookupPhoneResult,
): DemoPhoneCheck {
  if (!format.ok) return format;
  if ('skipped' in lookup) return format;
  if (!lookup.valid) {
    return { ok: false, reason: 'lookup', message: DEMO_PHONE_CORRECTION };
  }
  return format;
}

export async function lookupDemoPhone(
  e164: string,
  creds: { accountSid: string; authToken: string } | null,
): Promise<LookupPhoneResult> {
  if (!creds?.accountSid || !creds.authToken) return { skipped: true };
  const url = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(e164)}`;
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString('base64')}`,
      },
    });
    if (response.status === 404) return { valid: false };
    if (!response.ok) return { skipped: true };
    const data = (await response.json()) as { valid?: boolean };
    if (typeof data.valid !== 'boolean') return { skipped: true };
    return { valid: data.valid };
  } catch {
    return { skipped: true };
  }
}

export async function assertBookableDemoPhone(
  raw: string | null | undefined,
  creds: { accountSid: string; authToken: string } | null,
): Promise<DemoPhoneCheck> {
  const format = validateDemoPhoneFormat(raw);
  if (!format.ok) return format;
  const lookup = await lookupDemoPhone(format.e164, creds);
  return combineDemoPhoneChecks(format, lookup);
}

export function buildConfirmationFailedAlert(params: {
  name: string;
  phone: string;
  email: string;
  when: string;
  reason: string;
}): string {
  return (
    `⚠️ Confirmación de demo NO enviada\n\n` +
    `Cliente: ${params.name}\n` +
    `WhatsApp: ${params.phone}\n` +
    `Email: ${params.email}\n` +
    `Horario: ${params.when}\n` +
    `Motivo: ${params.reason}\n\n` +
    `confirmation_sent = false. Hay que contactar manualmente.`
  );
}
