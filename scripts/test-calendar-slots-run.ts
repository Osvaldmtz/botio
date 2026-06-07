import { fromZonedTime } from 'date-fns-tz';
import {
  customerLocalToUtcDate,
  formatSlotForES,
  generateHostCandidateSlots,
  getCustomerTzParts,
  getHostTzParts,
  hostLocalToDate,
  isWithinHostBusinessHours,
  isWithinOverlapBusinessHours,
  parseRelativeDate,
  parseTimeFromText,
} from '../lib/calendar-slots';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

process.env.TZ = 'UTC';

console.log('Running calendar slot tests (server TZ=%s)', process.env.TZ);

const bogotaSlot = hostLocalToDate(2026, 6, 8, 16, 30);
const bogotaLabel = formatSlotForES(bogotaSlot, 'America/Bogota', 'hora Bogotá');
assert(bogotaLabel.includes('16:30'), `Expected 16:30 Bogotá, got: ${bogotaLabel}`);
assert(!bogotaLabel.includes('21:30'), `UTC leak in label: ${bogotaLabel}`);

const cdmxLabel = formatSlotForES(bogotaSlot, 'America/Mexico_City', 'hora CDMX');
assert(cdmxLabel.includes('15:30'), `Expected 15:30 CDMX, got: ${cdmxLabel}`);

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
  formatSlotForES(fromLocal, 'America/Bogota', 'hora Bogotá').includes('14:00'),
  '14:00 Bogota formatting failed',
);
assert(
  formatSlotForES(fromLocal, 'America/Mexico_City', 'hora CDMX').includes('13:00'),
  '13:00 CDMX formatting failed',
);

console.log(`✓ ${candidates.length} host slots validated (9–20h Bogotá)`);

const mondayDate = parseRelativeDate('el lunes', new Date('2026-06-07T15:00:00Z'));
assert(mondayDate !== null, 'parseRelativeDate failed for el lunes');
assert(parseTimeFromText('a las 12:30') === '12:30', 'parseTimeFromText failed');

const mxSlot = customerLocalToUtcDate(mondayDate!, '12:30', 'America/Mexico_City');
const hostHour = getHostTzParts(mxSlot).hour;
assert(hostHour === 13, `Expected 13:30 Bogota host hour, got ${hostHour}:30`);
assert(
  formatSlotForES(mxSlot, 'America/Mexico_City', 'hora CDMX').includes('12:30'),
  'MX display should show 12:30',
);

console.log('✓ parseRelativeDate + customer timezone conversion OK');

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
