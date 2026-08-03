import { normalizePhone } from '@/lib/phone';

export function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** Compares phones stored in mixed formats (+52 spaces, bare 10-digit, etc.). */
export function phonesEquivalent(a: string, b: string): boolean {
  const da = digitsOnly(a);
  const db = digitsOnly(b);
  if (!da || !db) return false;
  if (da === db) return true;
  if (da.length >= 10 && db.length >= 10 && da.slice(-10) === db.slice(-10)) {
    return true;
  }
  return false;
}

export function buildPhoneLookupSuffixes(senderPhone: string): string[] {
  const normalized = normalizePhone(senderPhone) ?? senderPhone.trim();
  const digits = digitsOnly(normalized);
  if (digits.length < 7) return [];

  const suffixes: string[] = [];
  if (digits.length >= 10) suffixes.push(digits.slice(-10));
  for (const len of [7, 6, 5, 4]) {
    if (digits.length >= len) suffixes.push(digits.slice(-len));
  }
  return Array.from(new Set(suffixes));
}

/** @deprecated Use buildPhoneLookupSuffixes */
export function buildPhoneLookupSuffix(senderPhone: string): string | null {
  const suffixes = buildPhoneLookupSuffixes(senderPhone);
  return suffixes[0] ?? null;
}

export function formatPsychologistNotification(
  patientName: string,
  messageBody: string,
  patientPhone: string,
): string {
  return (
    `👤 Tu paciente ${patientName} te escribió al número de Kalyo:\n\n` +
    `'${messageBody}'\n\n` +
    `Respóndele directamente a su número: ${patientPhone}`
  );
}

export function formatPatientAck(patientName: string): string {
  return (
    `Hola ${patientName}, tu mensaje fue enviado a tu psicólogo. ` +
    `En breve te contactará directamente. 😊`
  );
}

export function displayPatientName(fullName: string | null | undefined): string {
  const trimmed = fullName?.trim();
  return trimmed || 'paciente';
}
