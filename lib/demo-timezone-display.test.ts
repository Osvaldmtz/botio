import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatSlotTimeDual, buildCalendarSlot, formatCustomerSlotOffer, formatSlotLabelsForPhone } from './calendar-slots';
import { formatDemoConfirmationMessage } from './demo-booking-messages';
import { formatReminder24h } from './demo-reminder-messages';
import { demoDisplayTimezone } from './timezone-from-phone';

const AT = new Date('2026-10-01T14:00:00.000Z');

describe('demo clock follows the phone', () => {
  it('shows CDMX for +52 on the booking confirmation and the reminder', () => {
    const zone = demoDisplayTimezone('+527774288133', {
      timezone: 'America/Bogota',
      label: 'hora de Colombia',
    });
    assert.equal(zone.timezone, 'America/Mexico_City');
    assert.equal(zone.label, 'CDMX');
    assert.equal(formatSlotTimeDual(AT, zone.timezone, zone.label), '08:00 (CDMX)');

    const booked = formatDemoConfirmationMessage(AT, 'erika@example.com', zone.timezone, zone.label);
    assert.match(booked, /08:00 \(CDMX\)/);
    assert.equal(booked.includes('Colombia'), false);

    const reminder = formatReminder24h(
      {
        id: 'demo',
        conversation_id: 'conv',
        customer_name: 'Erika',
        customer_email: 'erika@example.com',
        customer_phone: '+527774288133',
        scheduled_at: AT.toISOString(),
        google_meet_link: 'https://meet.google.com/pgd-dxmb-sfk',
      },
      zone,
    );
    assert.match(reminder, /08:00 \(CDMX\)/);
    assert.equal(reminder.includes('Colombia'), false);
  });

  it('shows Bogotá for +57 on the booking confirmation and the reminder', () => {
    const zone = demoDisplayTimezone('+573001112233');
    assert.equal(zone.timezone, 'America/Bogota');
    assert.equal(zone.label, 'Bogotá');
    assert.equal(formatSlotTimeDual(AT, zone.timezone, zone.label), '09:00 (Bogotá)');

    const booked = formatDemoConfirmationMessage(AT, 'ana@example.com', zone.timezone, zone.label);
    assert.match(booked, /09:00 \(Bogotá\)/);

    const reminder = formatReminder24h(
      {
        id: 'demo',
        conversation_id: null,
        customer_name: 'Ana',
        customer_email: 'ana@example.com',
        customer_phone: '+573001112233',
        scheduled_at: AT.toISOString(),
        google_meet_link: 'https://meet.google.com/pgd-dxmb-sfk',
      },
      zone,
    );
    assert.match(reminder, /09:00 \(Bogotá\)/);
  });
});

const FRIDAY_NINE_CO = new Date('2026-10-02T14:00:00.000Z');
const THURSDAY_ONE_CO = new Date('2026-10-01T18:00:00.000Z');

describe('slot offers are in the customer clock', () => {
  it('shows +52 in CDMX and keeps the UTC instant', () => {
    const friday = buildCalendarSlot(
      FRIDAY_NINE_CO,
      30,
      '+527224183685',
      'America/Bogota',
      'hora de Colombia',
    );
    assert.equal(friday.start, '2026-10-02T14:00:00.000Z');
    assert.equal(friday.end, '2026-10-02T14:30:00.000Z');
    assert.equal(friday.display_timezone, 'America/Mexico_City');
    assert.equal(friday.display_label, 'CDMX');
    assert.match(friday.label_es, /08:00 AM/);
    assert.equal(friday.label_es.includes('Colombia'), false);

    const thursday = buildCalendarSlot(THURSDAY_ONE_CO, 30, '+527224183685');
    const offer = formatCustomerSlotOffer([thursday, friday, thursday]);
    assert.match(offer, /Horarios en tu hora \(CDMX\):/);
    assert.match(offer, /12:00 PM/);
    assert.match(offer, /08:00 AM/);
    assert.equal(offer.includes('Colombia'), false);
  });

  it('shows +57 in Bogotá', () => {
    const slot = formatSlotLabelsForPhone(FRIDAY_NINE_CO, '+573001112233');
    assert.equal(slot.display_timezone, 'America/Bogota');
    assert.equal(slot.display_label, 'Bogotá');
    assert.match(slot.label_es, /09:00 AM/);
    assert.match(formatCustomerSlotOffer([slot]), /Horarios en tu hora \(Bogotá\):/);
  });

  it('shows +51 in Lima', () => {
    const slot = formatSlotLabelsForPhone(FRIDAY_NINE_CO, '+51999888777');
    assert.equal(slot.display_timezone, 'America/Lima');
    assert.equal(slot.display_label, 'Lima');
    assert.match(slot.label_es, /09:00 AM/);
    assert.match(formatCustomerSlotOffer([slot]), /Horarios en tu hora \(Lima\):/);
  });

  it('uses Bogotá when the phone is not a known calling code', () => {
    const slot = formatSlotLabelsForPhone(FRIDAY_NINE_CO, 'no-es-telefono');
    assert.equal(slot.display_timezone, 'America/Bogota');
    assert.equal(slot.display_label, 'Bogotá');
    assert.match(slot.label_es, /09:00 AM/);
    assert.match(formatCustomerSlotOffer([slot]), /Horarios en tu hora \(Bogotá\):/);
  });
});
