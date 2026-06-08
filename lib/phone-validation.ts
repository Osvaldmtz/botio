export function normalizePhoneForDB(phone: string): string {
  return phone.replace(/[\s\-\(\)]/g, '');
}

export function isValidPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  return /^\+[1-9]\d{7,14}$/.test(phone);
}
