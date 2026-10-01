import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildDemoReminderTelegramText } from './demo-reminder-notifications';
import {
  decideReminderAction,
  formatCancellationAsk,
  hasActivePendingSlots,
  looksLikeReminderReschedule,
  pendingSlotsWithAlternatives,
  pipelineStageForCancellationReason,
} from './demo-flow-parsing';
import { shouldInterceptDemoConfirm } from './demo-flow-parsing';

const identity = {
  customer_email: 'maria@example.com',
  customer_name: 'María',
  customer_phone: '+593995426554',
  customer_timezone: 'America/Guayaquil',
  customer_city_label: 'Guayaquil',
  display_timezone: 'America/Guayaquil',
  display_label: 'Guayaquil',
};

const tuesday = {
  start: '2026-10-06T14:00:00.000Z',
  end: '2026-10-06T14:30:00.000Z',
  label_es: 'Martes 6 oct, 09:00 (de Colombia)',
  display_timezone: 'America/Bogota',
  display_label: 'de Colombia',
};

const pendingOffer = {
  ...identity,
  slots: [tuesday],
  offered_at: '2026-10-01T15:27:43.000Z',
  expires_at: '2026-10-02T15:00:00.000Z',
};

describe('check_specific_time alternatives', () => {
  it('stores alternatives even when nothing was pending and expires at the original demo', () => {
    const saved = pendingSlotsWithAlternatives({
      existing: null,
      alternatives: [tuesday],
      identity,
      originalDemoAt: '2026-10-02T15:00:00.000Z',
      nowIso: '2026-10-01T15:27:43.000Z',
    });
    assert.ok(saved);
    assert.equal(saved.slots.length, 1);
    assert.equal(saved.slots[0]?.label_es, tuesday.label_es);
    assert.equal(saved.expires_at, '2026-10-02T15:00:00.000Z');
    assert.equal(saved.customer_email, 'maria@example.com');
  });
});

describe('reminder vs slot confirm', () => {
  it('treats "3" as a slot choice and not a cancellation when slots are pending', () => {
    assert.equal(
      shouldInterceptDemoConfirm(pendingOffer, '3'),
      true,
    );
    assert.deepEqual(
      decideReminderAction({
        message: '3',
        hasActivePendingSlots: true,
        awaitingCancelReason: false,
      }),
      { kind: 'ignore' },
    );
  });

  it('lets the reminder handler see "3" only when no slots are pending', () => {
    assert.equal(hasActivePendingSlots(null), false);
    assert.deepEqual(
      decideReminderAction({
        message: '3',
        hasActivePendingSlots: false,
        awaitingCancelReason: false,
      }),
      { kind: 'ask_cancel' },
    );
  });

  it('ignores pending slots after the original demo hour', () => {
    const afterDemo = Date.parse('2026-10-02T15:00:01.000Z');
    assert.equal(hasActivePendingSlots(pendingOffer, afterDemo), false);
  });
});

describe('reschedule phrases during a reminder', () => {
  it('routes "puede ser más tarde" and "no puedo" to reschedule', () => {
    assert.equal(
      looksLikeReminderReschedule('disculpe puede ser más tarde tengo que dar clases'),
      true,
    );
    assert.deepEqual(
      decideReminderAction({
        message: 'no puedo',
        hasActivePendingSlots: false,
        awaitingCancelReason: false,
      }),
      { kind: 'reschedule' },
    );
    assert.deepEqual(
      decideReminderAction({
        message: 'mejor otro día',
        hasActivePendingSlots: false,
        awaitingCancelReason: false,
      }),
      { kind: 'reschedule' },
    );
  });
});

describe('formal cancellation', () => {
  it('asks for a reason and offers to reschedule in the same turn', () => {
    const ask = formatCancellationAsk();
    assert.match(ask, /razón/i);
    assert.match(ask, /reagendar/i);
    assert.match(ask, /opcional/i);
  });

  it('maps the reason to lost or qualified', () => {
    assert.equal(pipelineStageForCancellationReason('no me interesa'), 'lost');
    assert.equal(pipelineStageForCancellationReason('no puedo hoy'), 'qualified');
    assert.deepEqual(
      decideReminderAction({
        message: 'no me interesa',
        hasActivePendingSlots: false,
        awaitingCancelReason: true,
      }),
      { kind: 'cancel', reason: 'no me interesa', pipeline: 'lost' },
    );
    assert.deepEqual(
      decideReminderAction({
        message: 'no puedo hoy',
        hasActivePendingSlots: false,
        awaitingCancelReason: true,
      }),
      { kind: 'cancel', reason: 'no puedo hoy', pipeline: 'qualified' },
    );
    assert.deepEqual(
      decideReminderAction({
        message: 'reagendar',
        hasActivePendingSlots: false,
        awaitingCancelReason: true,
      }),
      { kind: 'reschedule' },
    );
  });
});

describe('telegram cancellation alert', () => {
  it('states the pipeline stage that was written', () => {
    const text = buildDemoReminderTelegramText(
      'customer_cancelled',
      {
        id: 'demo-1',
        conversation_id: 'conv-1',
        customer_name: 'María',
        customer_email: 'maria@example.com',
        customer_phone: '+593995426554',
        scheduled_at: '2026-10-02T15:00:00.000Z',
        google_meet_link: 'https://meet.google.com/pgd-dxmb-sfk',
      },
      { timezone: 'America/Guayaquil', label: 'Guayaquil' },
      { cancellation_reason: 'no me interesa', pipeline_stage: 'lost' },
    );
    assert.match(text, /Pipeline: lost/);
    assert.equal(text.includes('se mantiene'), false);
  });
});
