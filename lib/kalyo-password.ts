import { randomBytes } from 'node:crypto';

/** Unambiguous WhatsApp alphabet: no I/O/0/1. Keep in sync with psyplatform/lib/kalyo-password.ts */
const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SUFFIX_LEN = 4;

/**
 * Temporary trial password. No hyphens: WhatsApp copy turns ASCII `-` into
 * en/em dashes, which Auth rejects.
 */
export function generateKalyoPassword(now = new Date()): string {
  const year = now.getFullYear();
  const bytes = randomBytes(SUFFIX_LEN);
  let suffix = '';
  for (let i = 0; i < SUFFIX_LEN; i++) {
    suffix += PASSWORD_CHARS[bytes[i]! % PASSWORD_CHARS.length];
  }
  return `Kalyo${year}${suffix}`;
}

export function isKalyoTempPasswordFormat(password: string): boolean {
  return /^Kalyo\d{4}[A-HJ-NP-Z2-9]{4}$/.test(password);
}

/** Own line so long-press copy in WhatsApp does not pick up surrounding punctuation. */
export function formatWhatsAppTempPasswordBlock(tempPassword: string): string {
  return (
    `🔑 Contraseña (cópiala tal cual, en una sola línea):\n` +
    `${tempPassword}\n` +
    `(Puedes cambiarla después de entrar)\n`
  );
}
