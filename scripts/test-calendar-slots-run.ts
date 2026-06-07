import { fromZonedTime } from 'date-fns-tz';
import {
  customerLocalToUtcDate,
  formatSlotForES,
  generateHostCandidateSlots,
  getHostTzParts,
  hostLocalToDate,
  isWithinHostBusinessHours,
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
console.log('✓ All calendar slot timezone tests passed');
