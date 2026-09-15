import { fromZonedTime } from 'date-fns-tz';
import {
  customerLocalToUtcDate,
  formatSlotForCustomerRequest,
  formatSlotForES,
  formatSlotTimeDual,
  generateHostCandidateSlots,
  getCustomerTzParts,
  getHostTzParts,
  hostLocalToDate,
  isWithinHostBusinessHours,
  isWithinOverlapBusinessHours,
  normalizeRequestedTime,
  parseRelativeDate,
  parseTimeFromText,
} from '../lib/calendar-slots';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

process.env.TZ = 'UTC';

console.log('Running calendar slot tests (server TZ=%s)', process.env.TZ);

// 16:30 Bogotá = 15:30 CDMX (always UTC-5 vs UTC-6)
const bogotaSlot = hostLocalToDate(2026, 6, 8, 16, 30);
const bogotaLabel = formatSlotForES(bogotaSlot, 'America/Bogota', 'hora Bogotá');
assert(bogotaLabel.includes('15:30'), `Expected 15:30 CDMX primary, got: ${bogotaLabel}`);
assert(bogotaLabel.includes('CDMX'), `Expected CDMX label, got: ${bogotaLabel}`);
assert(
  bogotaLabel.includes('16:30 tu hora en Bogotá'),
  `Expected dual Bogotá 16:30, got: ${bogotaLabel}`,
);
assert(!bogotaLabel.includes('21:30'), `UTC leak in label: ${bogotaLabel}`);

const cdmxLabel = formatSlotForES(bogotaSlot, 'America/Mexico_City', 'hora CDMX');
assert(cdmxLabel.includes('15:30'), `Expected 15:30 CDMX, got: ${cdmxLabel}`);
assert(
  !cdmxLabel.includes('tu hora'),
  `Same-zone should not dual-label: ${cdmxLabel}`,
);

const start = new Date();
const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
const candidates = generateHostCandidateSlots(start, end, 15);

assert(candidates.length > 0, 'Expected at least one candidate slot');

for (const slot of candidates) {
  const parts = getHostTzParts(slot);
  assert(
    isWithinHostBusinessHours(slot, 15),
    `Slot outside business hours: ${parts.hour}:${parts.minute}`,
  );
  assert(parts.hour >= 9 && parts.hour < 20, `Hour ${parts.hour} out of range for ${slot.toISOString()}`);
}

const utcInstant = new Date('2026-06-09T19:00:00.000Z');
const hostParts = getHostTzParts(utcInstant);
assert(hostParts.hour === 14, `Expected 14:00 host hour, got ${hostParts.hour}`);

const fromLocal = fromZonedTime('2026-06-09T14:00:00', 'America/Bogota');
assert(
  formatSlotForES(fromLocal, 'America/Bogota', 'hora Bogotá').includes('13:00 CDMX'),
  '14:00 Bogotá should show as 13:00 CDMX',
);
assert(
  formatSlotForES(fromLocal, 'America/Bogota', 'Bogotá').includes('14:00 tu hora en Bogotá'),
  'dual Bogotá clock failed',
);
assert(
  formatSlotForES(fromLocal, 'America/Mexico_City', 'hora CDMX').includes('13:00'),
  '13:00 CDMX formatting failed',
);
assert(
  !formatSlotForES(fromLocal, 'America/Mexico_City', 'hora CDMX').includes('tu hora'),
  'CDMX customer should not dual-label',
);

console.log(`✓ ${candidates.length} host slots validated (9–20h Bogotá)`);

const mondayDate = parseRelativeDate('el lunes', new Date('2026-06-07T15:00:00Z'));
assert(mondayDate !== null, 'parseRelativeDate failed for el lunes');
assert(parseTimeFromText('a las 12:30') === '12:30', 'parseTimeFromText failed');
assert(parseTimeFromText('mañana miércoles a las 14 horas') === '14:00', 'a las 14 horas');
assert(parseTimeFromText('a las 14') === '14:00', 'a las 14');
assert(parseTimeFromText('14 horas') === '14:00', '14 horas');
assert(normalizeRequestedTime('14') === '14:00', 'bare 14');
assert(normalizeRequestedTime('2 pm') === '14:00', '2 pm');

// Custom request: 14:00 Bogotá → 13:00 CDMX (NOT 09:00)
const bogotaFourteen = customerLocalToUtcDate('2026-09-16', '14:00', 'America/Bogota');
assert(bogotaFourteen.toISOString() === '2026-09-16T19:00:00.000Z', '14 Bogotá → 19:00Z');
const customLabel = formatSlotForCustomerRequest(bogotaFourteen, 'America/Bogota', 'Bogotá');
assert(customLabel.includes('14:00 Bogotá'), `Expected 14:00 Bogotá, got: ${customLabel}`);
assert(customLabel.includes('13:00 CDMX'), `Expected 13:00 CDMX, got: ${customLabel}`);
assert(!customLabel.includes('09:00'), `Must not show 09:00 CDMX: ${customLabel}`);

const mxSlot = customerLocalToUtcDate(mondayDate!, '12:30', 'America/Mexico_City');
const hostHour = getHostTzParts(mxSlot).hour;
assert(hostHour === 13, `Expected 13:30 Bogota host hour, got ${hostHour}:30`);
assert(
  formatSlotForES(mxSlot, 'America/Mexico_City', 'hora CDMX').includes('12:30'),
  'MX display should show 12:30',
);

console.log('✓ parseRelativeDate + customer timezone conversion OK');
console.log('✓ custom request 14:00 Bogotá → 13:00 CDMX OK');

// --- Regression: CDMX ↔ Bogotá is 1h, never +5 from UTC hour ---
const cdmxNine = fromZonedTime('2026-09-16T09:00:00', 'America/Mexico_City');
const bogotaDual = formatSlotForES(cdmxNine, 'America/Bogota', 'Bogotá');
assert(bogotaDual.includes('09:00 CDMX'), `Expected 09:00 CDMX, got: ${bogotaDual}`);
assert(
  bogotaDual.includes('10:00 tu hora en Bogotá'),
  `Expected 10:00 Bogotá (NOT 14:00), got: ${bogotaDual}`,
);
assert(!bogotaDual.includes('14:00'), `Must not leak UTC hour as Bogotá: ${bogotaDual}`);
assert(
  formatSlotTimeDual(cdmxNine, 'America/Bogota', 'Bogotá') ===
    '09:00 CDMX (10:00 tu hora en Bogotá)',
  'formatSlotTimeDual CDMX→Bogotá mismatch',
);

// Monterrey ≈ CDMX (same clock) → no dual
const monterreyLabel = formatSlotForES(cdmxNine, 'America/Monterrey', 'Monterrey');
assert(monterreyLabel.includes('09:00 CDMX'), `Monterrey primary: ${monterreyLabel}`);
assert(!monterreyLabel.includes('tu hora'), `Monterrey should not dual: ${monterreyLabel}`);

// Lima = Bogotá (UTC-5)
const limaLabel = formatSlotForES(cdmxNine, 'America/Lima', 'Lima');
assert(
  limaLabel.includes('10:00 tu hora en Lima'),
  `Expected Lima 10:00, got: ${limaLabel}`,
);

// New York in September (EDT = UTC-4) → CDMX+2h
const nyLabel = formatSlotForES(cdmxNine, 'America/New_York', 'Nueva York');
assert(
  nyLabel.includes('11:00 tu hora en Nueva York'),
  `Expected NY 11:00 in Sep, got: ${nyLabel}`,
);

console.log('✓ CDMX dual conversions (Bogotá/Lima/Monterrey/NY) OK');

function assertCustomerHourRange(
  timezone: string,
  minHour: number,
  maxStartHour: number,
  label: string,
): void {
  const rangeStart = hostLocalToDate(2026, 6, 9, 0, 0);
  const rangeEnd = hostLocalToDate(2026, 6, 16, 0, 0);
  const all = generateHostCandidateSlots(rangeStart, rangeEnd, 15);
  const overlap = all.filter((s) => isWithinOverlapBusinessHours(s, 15, timezone));

  assert(overlap.length > 0, `Expected overlap slots for ${label}`);

  for (const slot of overlap) {
    const parts = getCustomerTzParts(slot, timezone);
    assert(
      parts.hour >= minHour,
      `${label}: slot ${parts.hour}:${parts.minute} before ${minHour}:00 local`,
    );
    assert(
      parts.hour < maxStartHour,
      `${label}: slot ${parts.hour}:${parts.minute} at or after ${maxStartHour}:00 local`,
    );
  }

  const earlyExcluded = all.some((s) => {
    const p = getCustomerTzParts(s, timezone);
    return p.hour === minHour - 1 && isWithinHostBusinessHours(s, 15);
  });
  if (minHour > 0) {
    assert(
      !overlap.some((s) => getCustomerTzParts(s, timezone).hour < minHour),
      `${label}: early slots should be excluded`,
    );
  }
  void earlyExcluded;

  console.log(`✓ ${label}: ${overlap.length} overlap slots within ${minHour}:00–${maxStartHour}:00 local`);
}

assertCustomerHourRange('America/Monterrey', 9, 19, 'Monterrey');
assertCustomerHourRange('America/Mexico_City', 9, 19, 'CDMX');
assertCustomerHourRange('America/Tijuana', 9, 18, 'Mexicali/Tijuana');
assertCustomerHourRange('Europe/Madrid', 16, 20, 'Madrid');

const monterreyBad = hostLocalToDate(2026, 6, 9, 9, 0);
assert(
  !isWithinOverlapBusinessHours(monterreyBad, 15, 'America/Monterrey'),
  '9:00 Cali (=8:00 Monterrey) must be excluded for Monterrey client',
);

console.log('✓ All calendar slot timezone tests passed');
