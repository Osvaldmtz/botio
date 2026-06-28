import { normalizePhoneForDB } from '@/lib/phone-validation';

export const KALYO_TEAM_EMAILS = [
  'alejacata17@gmail.com',   // Aleja - Directora Comercialización
  'zehynaperez1@gmail.com',  // Zehyna - Diseño y contenido
  'osvaldo@kalyo.io',        // Osvaldo - Founder
  'info@magnus.mx',          // Osvaldo - Magnus
  'ana@coloris.mx',          // Ana - familia (esposa de Osvaldo)
] as const;

/** Known team operator WhatsApp numbers (E.164). Also set KALYO_TEAM_PHONES in env. */
export const KALYO_TEAM_PHONES = [
  '+528114112000', // Osvaldo
  '+573113005269', // Aleja
] as const;

export function isTeamMember(email: string | null | undefined): boolean {
  if (!email) return false;
  return (KALYO_TEAM_EMAILS as readonly string[]).includes(email.toLowerCase().trim());
}

function teamPhonesFromEnv(): string[] {
  const raw = process.env.KALYO_TEAM_PHONES?.trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((p) => normalizePhoneForDB(p.trim()))
    .filter(Boolean);
}

/** Team operator WhatsApp (E.164). Set KALYO_TEAM_PHONES=+52...,+57... or is_team_member on conversation. */
export function isTeamOperatorPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const normalized = normalizePhoneForDB(phone.trim());
  const fromEnv = teamPhonesFromEnv();
  const known = (KALYO_TEAM_PHONES as readonly string[]).map((p) => normalizePhoneForDB(p));
  return fromEnv.includes(normalized) || known.includes(normalized);
}
