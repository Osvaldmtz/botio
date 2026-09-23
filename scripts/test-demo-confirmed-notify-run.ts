import assert from 'node:assert/strict';
import {
  buildDemoConfirmedEmail,
  buildDemoConfirmedTelegramText,
} from '../lib/demo-confirmed-notify';

const input = {
  customerName: 'Ana Pérez',
  customerEmail: 'ana@example.com',
  customerPhone: '+525512345678',
  scheduledAt: new Date('2026-09-25T16:00:00.000Z'),
  meetLink: 'https://meet.google.com/abc-defg-hij',
  source: 'landing_demo' as const,
  bookingId: 'booking-123',
  country: 'MX',
  interest: 'Evaluaciones',
};

const tg = buildDemoConfirmedTelegramText(input);
assert.match(tg, /Nueva demo confirmada/);
assert.match(tg, /Ana Pérez/);
assert.match(tg, /ana@example\.com/);
assert.match(tg, /kalyo\.io\/demo/);
assert.match(tg, /meet\.google\.com/);
assert.match(tg, /booking-123/);

const email = buildDemoConfirmedEmail(input);
assert.match(email.subject, /Demo confirmada/);
assert.match(email.subject, /Ana Pérez/);
assert.match(email.text, /WhatsApp: \+525512345678/);
assert.match(email.text, /Origen: kalyo\.io\/demo/);
assert.match(email.text, /País: MX/);

const bot = buildDemoConfirmedTelegramText({
  ...input,
  source: 'whatsapp_bot',
  conversationId: 'conv-abc',
  bookingId: undefined,
});
assert.match(bot, /WhatsApp \(Sofía\)/);
assert.match(bot, /admin\/conversations\/conv-abc/);

console.log('demo-confirmed-notify builders OK');
