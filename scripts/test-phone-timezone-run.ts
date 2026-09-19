/**
 * Tests: phone country code → timezone labels for demo slots.
 * Run: npx tsx scripts/test-phone-timezone-run.ts
 */
import { fromZonedTime } from 'date-fns-tz';
import {
  formatSlotForES,
  formatSlotTimeDual,
} from '../lib/calendar-slots';
import {
  getCustomerTimezone,
  getCustomerTimezoneLabel,
  resolvePhoneTimezone,
} from '../lib/timezone-from-phone';
import { getCustomerTimezone as fromAlias } from '../lib/phone-to-timezone';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

process.env.TZ = 'UTC';

console.log('Phone → timezone + local slot labels\n');

assert(getCustomerTimezone('+5215512345678') === 'America/Mexico_City', '+52 → Mexico_City');
assert(getCustomerTimezoneLabel('+5215512345678') === 'CDMX', '+52 → CDMX');

assert(getCustomerTimezone('+573001112233') === 'America/Bogota', '+57 → Bogota');
assert(getCustomerTimezoneLabel('+573001112233') === 'Bogotá', '+57 → Bogotá');

assert(getCustomerTimezone('+51999888777') === 'America/Lima', '+51 → Lima');
assert(getCustomerTimezoneLabel('+51999888777') === 'Lima', '+51 → Lima');

assert(getCustomerTimezone('+584121112233') === 'America/Caracas', '+58 → Caracas');
assert(getCustomerTimezone('+593991112233') === 'America/Guayaquil', '+593 → Guayaquil');
assert(
  getCustomerTimezone('+5491112345678') === 'America/Argentina/Buenos_Aires',
  '+54 → Buenos Aires',
);
assert(getCustomerTimezone('+56912345678') === 'America/Santiago', '+56 → Santiago');
assert(getCustomerTimezone('+15551234567') === 'America/Mexico_City', '+1 → Mexico_City');

assert(getCustomerTimezone(null) === 'America/Bogota', 'null → Bogotá fallback');
assert(getCustomerTimezone('') === 'America/Bogota', 'empty → Bogotá fallback');
assert(getCustomerTimezone('+999123') === 'America/Bogota', 'unknown → Bogotá fallback');
assert(getCustomerTimezoneLabel(undefined) === 'Bogotá', 'undefined label → Bogotá');

assert(fromAlias('+57300') === 'America/Bogota', 'phone-to-timezone alias works');

const mx = resolvePhoneTimezone('whatsapp:+52155');
assert(mx.timezone === 'America/Mexico_City' && mx.label === 'CDMX', 'whatsapp: prefix ok');

// Same instant: 09:00 CDMX = 10:00 Bogotá
const cdmxNine = fromZonedTime('2026-09-16T09:00:00', 'America/Mexico_City');

const mxLabel = formatSlotForES(cdmxNine, 'America/Mexico_City', 'CDMX');
assert(mxLabel.includes('09:00'), `MX local 09:00: ${mxLabel}`);
assert(mxLabel.includes('(CDMX)'), `MX label: ${mxLabel}`);
assert(!mxLabel.includes('Bogotá'), `MX must not say Bogotá: ${mxLabel}`);

const coLabel = formatSlotForES(cdmxNine, 'America/Bogota', 'Bogotá');
assert(coLabel.includes('10:00'), `CO local 10:00: ${coLabel}`);
assert(coLabel.includes('(Bogotá)'), `CO label: ${coLabel}`);
assert(!coLabel.includes('CDMX'), `CO must not say CDMX: ${coLabel}`);

const peLabel = formatSlotForES(cdmxNine, 'America/Lima', 'Lima');
assert(peLabel.includes('10:00') && peLabel.includes('(Lima)'), `PE: ${peLabel}`);

const phoneMx = '+525511112222';
const phoneCo = '+573001112233';
assert(
  formatSlotForES(cdmxNine, getCustomerTimezone(phoneMx), getCustomerTimezoneLabel(phoneMx)).includes(
    '(CDMX)',
  ),
  'phone +52 drives CDMX label',
);
assert(
  formatSlotForES(cdmxNine, getCustomerTimezone(phoneCo), getCustomerTimezoneLabel(phoneCo)).includes(
    '(Bogotá)',
  ),
  'phone +57 drives Bogotá label',
);

const slotsLine = `1️⃣ ${formatSlotForES(
  cdmxNine,
  getCustomerTimezone(phoneMx),
  getCustomerTimezoneLabel(phoneMx),
)}`;
assert(slotsLine.includes('(CDMX)'), `slot line MX: ${slotsLine}`);
assert(!slotsLine.includes('Bogotá'), `slot line MX no Bogotá: ${slotsLine}`);

assert(
  formatSlotTimeDual(cdmxNine, 'America/Bogota', 'Bogotá') === '10:00 (Bogotá)',
  'confirm time CO',
);
assert(
  formatSlotTimeDual(cdmxNine, 'America/Mexico_City', 'CDMX') === '09:00 (CDMX)',
  'confirm time MX',
);

assert(
  formatSlotTimeDual(cdmxNine, getCustomerTimezone(phoneCo), getCustomerTimezoneLabel(phoneCo)) ===
    '10:00 (Bogotá)',
  'confirm respects +57 phone timezone',
);

console.log('✓ All phone timezone + local label tests passed');
