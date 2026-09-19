/**
 * Alias entrypoint — phone country code → IANA timezone for demo labels.
 * Implementation lives in timezone-from-phone.ts (already used across Botio).
 */
export {
  DEFAULT_CUSTOMER_TIMEZONE,
  DEFAULT_CUSTOMER_TIMEZONE_LABEL,
  getCustomerTimezone,
  getCustomerTimezoneLabel,
  normalizePhoneForTimezone,
  resolvePhoneTimezone,
  type CustomerTimezone,
  type CustomerTimezoneLabel,
} from '@/lib/timezone-from-phone';
