import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatSlotTimeDual } from './calendar-slots';
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
