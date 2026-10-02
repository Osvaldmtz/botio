import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseRelativeDate } from './calendar-slots';
import type { PendingDemoSlots } from './demo-conversation';
import {
  applyDemoConfirmationGuard,
  looksLikeDemoConfirmation,
  parseSlotChoice,
  shouldInterceptDemoConfirm,
  shouldInterceptDemoTimeCheck,
} from './demo-flow-parsing';

const JUDITH_PENDING = {
  slots: [
    {
      start: '2026-10-01T18:00:00.000Z',
      end: '2026-10-01T18:30:00.000Z',
      label_es: 'Jueves 1 oct, 13:00 (de Colombia)',
      display_timezone: 'America/Bogota',
      display_label: 'de Colombia',
    },
    {
      start: '2026-10-02T14:00:00.000Z',
      end: '2026-10-02T14:30:00.000Z',
      label_es: 'Viernes 2 oct, 09:00 (de Colombia)',
      display_timezone: 'America/Bogota',
      display_label: 'de Colombia',
    },
    {
      start: '2026-10-01T18:30:00.000Z',
      end: '2026-10-01T19:00:00.000Z',
      label_es: 'Jueves 1 oct, 13:30 (de Colombia)',
      display_timezone: 'America/Bogota',
      display_label: 'de Colombia',
    },
  ],
  customer_email: 'jojuregules@gmail.com',
  customer_name: 'Judith',
  customer_timezone: 'America/Mexico_City',
  customer_city_label: 'CDMX',
  display_timezone: 'America/Mexico_City',
  display_label: 'CDMX',
  offered_at: '2026-10-01T05:31:40.059Z',
} as PendingDemoSlots;

const JUDITH_REPLY =
  'Perfecto, Judith. Confirmo tu demo para el **viernes 2 oct a las 09:00 (Colombia)**.\n\nTe enviaremos un email de confirmación con el link de Google Meet en breve.';

const KEILA_REPLY =
  'Entendido, solo por la tarde. Confirmo: tu opción es la **2️⃣ Lunes 28 sep, 15:00 (CDMX)** — ¿es correcto?';

describe('applyDemoConfirmationGuard', () => {
  it('blocks a demo confirmation that was not booked', () => {
    const guarded = applyDemoConfirmationGuard({
      replyText: 'Demo agendada. Te envío la invitación.',
      toolsCalled: ['schedule_demo'],
      conversationId: 'conv-test',
    });
    assert.equal(guarded.guarded, true);
    assert.equal(looksLikeDemoConfirmation(guarded.replyText), false);
  });

  it('blocks a slot confirmation that never called confirm_demo_slot', () => {
    assert.equal(looksLikeDemoConfirmation(KEILA_REPLY), true);
    const guarded = applyDemoConfirmationGuard({
      replyText: KEILA_REPLY,
      toolsCalled: [],
      conversationId: 'conv-test',
    });
    assert.equal(guarded.guarded, true);
    assert.equal(looksLikeDemoConfirmation(guarded.replyText), false);
  });

  it('blocks a confirmation when confirm_demo_slot did not succeed', () => {
    const guarded = applyDemoConfirmationGuard({
      replyText: '✅ ¡Demo agendada!',
      toolsCalled: ['confirm_demo_slot'],
      toolResults: { confirm_demo_slot: { status: 'need_email', bot_message: 'email?' } },
      conversationId: 'conv-test',
    });
    assert.equal(guarded.guarded, true);
  });

  it('allows the confirmation after a successful confirm_demo_slot', () => {
    const guarded = applyDemoConfirmationGuard({
      replyText: '✅ ¡Demo agendada!',
      toolsCalled: ['confirm_demo_slot'],
      toolResults: { confirm_demo_slot: { status: 'success', bot_message: 'ok' } },
      conversationId: 'conv-test',
    });
    assert.equal(guarded.guarded, false);
    assert.equal(guarded.replyText, '✅ ¡Demo agendada!');
  });

  it('blocks a prose confirmation that never called the calendar tool', () => {
    assert.equal(looksLikeDemoConfirmation(JUDITH_REPLY), true);
    const guarded = applyDemoConfirmationGuard({
      replyText: JUDITH_REPLY,
      toolsCalled: [],
      conversationId: 'conv-judith',
    });
    assert.equal(guarded.guarded, true);
  });
});

describe('weekday slot choice', () => {
  it('maps the only Friday in the offer', () => {
    assert.equal(parseSlotChoice('El viernes', JUDITH_PENDING), 2);
    assert.equal(shouldInterceptDemoConfirm(JUDITH_PENDING, 'El viernes'), true);
  });

  it('does not guess when two slots share the weekday', () => {
    assert.equal(parseSlotChoice('El jueves', JUDITH_PENDING), null);
  });

  it('does not treat a clock as a new date', () => {
    assert.equal(
      parseRelativeDate('Así es a las 9', new Date('2026-10-02T03:17:33.000Z')),
      null,
    );
    assert.equal(
      parseRelativeDate('el 9 de octubre', new Date('2026-10-02T03:17:33.000Z')),
      '2026-10-09',
    );
    assert.equal(shouldInterceptDemoTimeCheck(JUDITH_PENDING, 'Así es a las 9'), true);
  });
});
