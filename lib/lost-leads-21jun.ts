/**
 * Clasificación y datos de leads perdidos — outage 20-21 jun 2026.
 * Generado desde scripts/diagnose-lost-leads-21jun.ts --export
 */

export type LostLeadGroup = 'A' | 'B_LUIS' | 'B_2PSI' | 'C';

export type LostLeadRecord = {
  phone: string;
  category: 'PERDIDO' | 'A_MEDIAS';
  group: LostLeadGroup;
  firstMsg: string;
  firstInboundAt: string;
  name?: string;
  email?: string;
};

export const EXCLUDED_PHONES = [
  '+528120061135',
  '+528120065294',
  '+528120092611',
  '+525529895317', // OK — bot respondió antes del corte
];

const HOT_INTEREST_PHONES = new Set(['+528666461159', '+573206761969', '+523314584243']);

export function classifyTemplateGroup(
  phone: string,
  messageBodies: string[],
): LostLeadGroup {
  if (phone === '+573215005921') return 'B_LUIS';
  if (phone === '+529842778628') return 'B_2PSI';

  const allText = messageBodies.join(' ').toLowerCase();
  if (/\bprecio\b|\bcosto\b|\bprice\b/.test(allText)) return 'A';
  if (HOT_INTEREST_PHONES.has(phone)) return 'A';
  return 'C';
}

export function normalizePhone(from: string): string {
  const raw = from.replace(/^whatsapp:/i, '').trim();
  let digits = raw.replace(/\D/g, '');

  if (digits.startsWith('521') && digits.length === 13) {
    digits = '52' + digits.slice(3);
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  } else if (digits.length === 10) {
    return `+1${digits}`;
  }

  return digits.startsWith('52') || digits.startsWith('57') || digits.startsWith('1')
    ? `+${digits}`
    : raw.startsWith('+')
      ? raw
      : `+${digits}`;
}

export function phonesMatch(a: string, b: string): boolean {
  return normalizePhone(a) === normalizePhone(b);
}

export function hoursSince(iso: string): number {
  return Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000);
}

export function selectRescueTemplate(lead: LostLeadRecord): string {
  if (lead.group === 'A') {
    return `¡Hola! 👋 Soy Sofía de Kalyo.

Te escribo porque hace unas horas preguntaste por el precio de Kalyo, pero tuvimos un problema técnico y no pude responderte en su momento. Mil disculpas.

Te paso la info:

💎 *Kalyo Pro*: $29 USD/mes
🚀 *Kalyo Max*: $39 USD/mes (con Kaly asistente de voz)

Si quieres probar antes, tienes *15 días gratis sin tarjeta*.

¿Te activo el trial? Solo necesito tu nombre y email. 🙌`;
  }

  if (lead.group === 'B_LUIS') {
    const email = lead.email ?? 'tu email';
    return `¡Hola Luis Alberto! 👋

Soy Sofía de Kalyo. Recibí tu mensaje con tu email (${email}) pero hubo una falla técnica y no pude procesarlo en su momento. Mil disculpas por la espera.

Buenas noticias: te puedo activar tu trial Pro de 15 días gratis ahora mismo.

¿Confirmas que quieres proceder con ese email? Solo respóndeme "sí" y te lo activo. 🚀`;
  }

  if (lead.group === 'B_2PSI') {
    return `¡Hola! 👋 Soy Sofía de Kalyo.

Disculpa la demora — tuve un problema técnico y no pude responder a tiempo tu pregunta sobre tener 2 psicólogos en una cuenta.

Te respondo: actualmente cada psicólogo necesita su cuenta individual (por privacidad de pacientes y compliance HIPAA).

Para clínicas con varios profesionales tenemos un plan especial. ¿Quieres que te explique los detalles? 🙌`;
  }

  return `¡Hola! 👋 Soy Sofía de Kalyo.

Hace unas horas me escribiste pero tuvimos un problema técnico y no pude responderte. Mil disculpas por la espera.

¿Sigues interesado/a en conocer Kalyo? Te ofrezco:

✓ *15 días gratis* (sin tarjeta de crédito)
✓ *100+ evaluaciones validadas* con IA
✓ Reportes automáticos con IA
✓ *Kaly* — asistente clínico por voz

¿Te activo el trial gratis? 🚀`;
}
