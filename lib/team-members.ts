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
