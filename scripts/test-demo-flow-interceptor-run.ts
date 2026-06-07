import {
  applyDemoConfirmationGuard,
  hasCustomTimeRequest,
  looksLikeDemoConfirmation,
  parseSlotChoice,
  shouldInterceptDemoConfirm,
  shouldInterceptDemoTimeCheck,
} from '../lib/demo-flow-parsing';
import type { PendingDemoSlots } from '../lib/demo-conversation';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const pending = {
  slots: [
    { start: '2026-06-10T18:00:00.000Z', label_es: 'Lun 10 jun 12:00' },
    { start: '2026-06-11T18:00:00.000Z', label_es: 'Mar 11 jun 12:00' },
    { start: '2026-06-12T18:00:00.000Z', label_es: 'Mié 12 jun 12:00' },
  ],
  customer_email: 'test@example.com',
  customer_name: 'Test',
  customer_timezone: 'America/Mazatlan',
} as PendingDemoSlots;

console.log('Demo flow interceptor tests\n');

// parseSlotChoice — valid selections
for (const [input, expected] of [
  ['1', 1],
  ['2', 2],
  ['3', 3],
  ['1️⃣', 1],
  ['uno', 1],
  ['el 2', 2],
  ['2.', 2],
  ['tres', 3],
  ['sí', 'custom'],
] as const) {
  const slot = parseSlotChoice(input, { ...pending, custom: pending.slots[0] });
  assert(slot === expected, `parseSlotChoice("${input}") → ${expected}, got ${slot}`);
}

// parseSlotChoice — must NOT match partial / ambiguous
for (const input of ['12:30', '1️⃣ Evaluaciones', '10', '21', 'opción 1 por favor']) {
  assert(parseSlotChoice(input, pending) === null, `"${input}" must not parse as slot`);
}

// shouldInterceptDemoConfirm — requires pending slots
assert(!shouldInterceptDemoConfirm(null, '2'), 'null pending must not intercept');
assert(
  !shouldInterceptDemoConfirm({ ...pending, slots: [] }, '2'),
  'empty slots must not intercept',
);
assert(shouldInterceptDemoConfirm(pending, '2'), '"2" with pending must intercept');

// cache quick reply without pending — regression
assert(
  !shouldInterceptDemoConfirm(null, '1️⃣ Evaluaciones'),
  'cache message without pending must not intercept',
);

// time check interception
assert(
  shouldInterceptDemoTimeCheck(pending, 'Es a las 12:30?'),
  'time question with pending must intercept check',
);
assert(
  !shouldInterceptDemoTimeCheck(pending, '2'),
  'slot number must use confirm, not time check',
);
assert(hasCustomTimeRequest('lunes 12:30'), 'hasCustomTimeRequest for lunes 12:30');

// response guard
assert(
  looksLikeDemoConfirmation('¡Listo! Demo confirmada para el lunes.'),
  'must detect hallucinated confirmation',
);
const guarded = applyDemoConfirmationGuard({
  replyText: 'Demo agendada. Te envío la invitación.',
  toolsCalled: ['schedule_demo'],
  conversationId: 'conv-test',
});
assert(guarded.guarded, 'must guard when confirm_demo_slot missing');
assert(
  !applyDemoConfirmationGuard({
    replyText: 'Demo agendada.',
    toolsCalled: ['confirm_demo_slot'],
    conversationId: 'conv-test',
  }).guarded,
  'must not guard when tool was called',
);

console.log('✓ All demo flow interceptor tests passed');
