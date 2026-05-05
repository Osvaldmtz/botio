/**
 * Normalizes a phone number received from Twilio/WhatsApp:
 * - Strips the `whatsapp:` channel prefix (case-insensitive).
 * - Converts Mexican mobile numbers from the old Twilio format +521XXXXXXXXXX
 *   (14 chars) to the post-2022 standard +52XXXXXXXXXX. Other countries are
 *   left unchanged (e.g. Argentina +549 retains the 9).
 */
export function normalizePhone(phone: string | undefined): string | undefined {
  if (!phone) return undefined;
  const stripped = phone.trim().replace(/^whatsapp:/i, '');
  if (!stripped) return undefined;
  // +521 + 10 digits = 14 chars total → old Mexican mobile format
  if (stripped.startsWith('+521') && stripped.length === 14) {
    return '+52' + stripped.slice(4);
  }
  return stripped;
}
