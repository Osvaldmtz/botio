import { normalizePhoneForDB } from '@/lib/phone-validation';

export const KALYO_TEAM_EMAILS = [
  'alejacata17@gmail.com',   // Aleja - Directora Comercialización
  'zehynaperez1@gmail.com',  // Zehyna - Diseño y contenido
  'osvaldo@kalyo.io',        // Osvaldo - Founder
  'info@magnus.mx',          // Osvaldo - Magnus
  'ana@coloris.mx',          // Ana - familia (esposa de Osvaldo)
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

/** Team operator WhatsApp (E.164). Set KALYO_TEAM_PHONES=+52...,+1... or is_team_member on conversation. */
export function isTeamOperatorPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const normalized = normalizePhoneForDB(phone.trim());
  return teamPhonesFromEnv().includes(normalized);
}
