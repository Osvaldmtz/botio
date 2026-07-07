import { createHash } from 'node:crypto';

const WEB_ONLY_PREFIX = '+999';

/** Synthetic E.164 phone for web-only customers without WhatsApp. */
export function emailToWebOnlyPhone(email: string): string {
  const normalized = email.trim().toLowerCase();
  const hash = createHash('sha256').update(normalized).digest('hex');
  const digits = hash.replace(/[^0-9]/g, '').slice(0, 10).padEnd(10, '0');
  return `${WEB_ONLY_PREFIX}${digits}`;
}

export function isWebOnlyPhone(phone: string | null | undefined): boolean {
  return typeof phone === 'string' && phone.startsWith(WEB_ONLY_PREFIX);
}
