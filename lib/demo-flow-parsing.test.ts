import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyDemoConfirmationGuard, looksLikeDemoConfirmation } from './demo-flow-parsing';

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
});
