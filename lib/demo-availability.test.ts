import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hostLocalToDate } from './calendar-slots';
import {
  pickPrioritySlots,
  slotBlockReason,
  type AvailabilityContext,
  type OccupiedInterval,
} from './demo-availability';

function at(year: number, month: number, day: number, hour: number, minute = 0): Date {
  return hostLocalToDate(year, month, day, hour, minute);
}

function booking(start: Date): OccupiedInterval {
  return { start, end: new Date(start.getTime() + 30 * 60_000) };
}

function context(
  bookings: OccupiedInterval[],
  extra?: Partial<AvailabilityContext>,
): AvailabilityContext {
  return {
    bookings,
    busy: [],
    reference: at(2026, 9, 30, 8),
    durationMinutes: 30,
    ...extra,
  };
}

describe('demo availability', () => {
  it('keeps weekday hours at 9:00–18:00 Colombia and closes Sunday', () => {
    const open = context([]);
    assert.equal(slotBlockReason(at(2026, 9, 30, 9), open), null);
    assert.equal(slotBlockReason(at(2026, 9, 30, 15, 30), open), null);
    assert.equal(slotBlockReason(at(2026, 9, 30, 17, 30), open), null);
    assert.equal(slotBlockReason(at(2026, 9, 30, 8, 30), open), 'outside_hours');
    assert.equal(slotBlockReason(at(2026, 9, 30, 18), open), 'outside_hours');
    assert.equal(slotBlockReason(at(2026, 10, 4, 12), open), 'outside_hours');
  });

  it('limits Saturday to 9:00–13:00 and two demos', () => {
    const open = context(
      [
        booking(at(2026, 10, 7, 9)),
        booking(at(2026, 10, 7, 10)),
        booking(at(2026, 10, 7, 11)),
        booking(at(2026, 10, 7, 12)),
        booking(at(2026, 10, 7, 13)),
        booking(at(2026, 10, 8, 9)),
        booking(at(2026, 10, 8, 10)),
        booking(at(2026, 10, 8, 11)),
        booking(at(2026, 10, 8, 12)),
        booking(at(2026, 10, 8, 13)),
        booking(at(2026, 10, 9, 9)),
        booking(at(2026, 10, 9, 10)),
        booking(at(2026, 10, 9, 11)),
        booking(at(2026, 10, 9, 12)),
        booking(at(2026, 10, 9, 13)),
      ],
      { reference: at(2026, 10, 7, 8) },
    );
    assert.equal(slotBlockReason(at(2026, 10, 10, 8, 30), open), 'outside_hours');
    assert.equal(slotBlockReason(at(2026, 10, 10, 9), open), null);
    assert.equal(slotBlockReason(at(2026, 10, 10, 12, 30), open), null);
    assert.equal(slotBlockReason(at(2026, 10, 10, 13), open), 'outside_hours');

    const fullSaturday = context(
      [...open.bookings, booking(at(2026, 10, 10, 12)), booking(at(2026, 10, 10, 9))],
      { reference: at(2026, 10, 7, 8) },
    );
    assert.equal(slotBlockReason(at(2026, 10, 10, 12, 30), fullSaturday), 'daily_max');
  });

  it('opens Saturday 3 Oct 2026 with weekday-level capacity', () => {
    const twoBooked = context([
      booking(at(2026, 10, 3, 10)),
      booking(at(2026, 10, 3, 13)),
    ]);
    assert.equal(slotBlockReason(at(2026, 10, 3, 9), twoBooked), null);
    assert.equal(slotBlockReason(at(2026, 10, 3, 11), twoBooked), null);
    assert.equal(slotBlockReason(at(2026, 10, 3, 12), twoBooked), null);
    assert.equal(slotBlockReason(at(2026, 10, 3, 12, 30), twoBooked), 'conflict');

    const fiveBooked = context([
      booking(at(2026, 10, 3, 9)),
      booking(at(2026, 10, 3, 10)),
      booking(at(2026, 10, 3, 11)),
      booking(at(2026, 10, 3, 12)),
      booking(at(2026, 10, 3, 12, 30)),
    ]);
    assert.equal(slotBlockReason(at(2026, 10, 3, 9, 30), fiveBooked), 'daily_max');
  });

  it('requires 30 minutes between demos', () => {
    const taken = context([booking(at(2026, 9, 30, 9))]);
    assert.equal(slotBlockReason(at(2026, 9, 30, 9, 30), taken), 'conflict');
    assert.equal(slotBlockReason(at(2026, 9, 30, 10), taken), null);
  });

  it('counts scheduled rows toward the weekday maximum of 5', () => {
    const full = context([
      booking(at(2026, 9, 30, 9)),
      booking(at(2026, 9, 30, 10)),
      booking(at(2026, 9, 30, 11)),
      booking(at(2026, 9, 30, 12)),
      booking(at(2026, 9, 30, 13)),
    ]);
    assert.equal(slotBlockReason(at(2026, 9, 30, 14), full), 'daily_max');
  });

  it('closes Monday 5 Oct 2026 before 13:30 and opens the whole afternoon', () => {
    const open = context([]);
    assert.equal(slotBlockReason(at(2026, 10, 5, 9), open), 'morning_closed');
    assert.equal(slotBlockReason(at(2026, 10, 5, 13), open), 'morning_closed');
    assert.equal(slotBlockReason(at(2026, 10, 5, 13, 30), open), null);
    assert.equal(slotBlockReason(at(2026, 10, 5, 16), open), null);
    assert.equal(slotBlockReason(at(2026, 10, 5, 17, 30), open), null);
    assert.equal(slotBlockReason(at(2026, 10, 6, 9), open), null);
    assert.equal(slotBlockReason(at(2026, 10, 6, 16), open), null);
  });

  it('keeps afternoon slots open through 17:30 even without morning demos', () => {
    const two = context([booking(at(2026, 9, 30, 9)), booking(at(2026, 9, 30, 10))]);
    assert.equal(slotBlockReason(at(2026, 9, 30, 16), two), null);
    assert.equal(slotBlockReason(at(2026, 9, 30, 9, 30), two), 'conflict');
    assert.equal(slotBlockReason(at(2026, 9, 30, 11), two), null);

    const three = context([
      booking(at(2026, 9, 30, 9)),
      booking(at(2026, 9, 30, 10)),
      booking(at(2026, 9, 30, 11)),
    ]);
    assert.equal(slotBlockReason(at(2026, 9, 30, 16), three), null);
  });

  it('offers Saturday only after the next three weekdays are full', () => {
    const slots = [
      at(2026, 10, 7, 9),
      at(2026, 10, 8, 9),
      at(2026, 10, 10, 12),
    ];
    const ctx = context([], { reference: at(2026, 10, 7, 8) });
    assert.deepEqual(
      pickPrioritySlots(slots.filter((slot) => slotBlockReason(slot, ctx) === null)).map(
        (slot) => slot.toISOString(),
      ),
      [at(2026, 10, 7, 9).toISOString(), at(2026, 10, 8, 9).toISOString()],
    );
  });

  it('orders preferred weekday slots before afternoon and Saturday', () => {
    const filled = [
      ...[9, 10, 11, 12, 13].map((hour) => booking(at(2026, 9, 30, hour))),
      ...[9, 10, 11, 12, 13].map((hour) => booking(at(2026, 10, 1, hour))),
      ...[9, 10, 11, 12, 13].map((hour) => booking(at(2026, 10, 2, hour))),
      booking(at(2026, 10, 5, 9)),
      booking(at(2026, 10, 5, 10)),
      booking(at(2026, 10, 5, 11)),
    ];
    const mondayMorning = at(2026, 10, 5, 15, 30);
    const mondayAfternoon = at(2026, 10, 5, 16);
    const saturday = at(2026, 10, 3, 12);
    const ctx = context(filled);
    const picked = pickPrioritySlots(
      [saturday, mondayAfternoon, mondayMorning].filter((slot) => slotBlockReason(slot, ctx) === null),
    );
    assert.deepEqual(
      picked.map((slot) => slot.toISOString()),
      [mondayMorning.toISOString(), mondayAfternoon.toISOString(), saturday.toISOString()],
    );
  });
});
