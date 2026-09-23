import assert from 'node:assert/strict';
import {
  DEMO_NAME_FALLBACK,
  demoGreetingName,
  extractNameFromUserMessages,
  holaDemo,
  isUsableDemoCustomerName,
  nameFromEmailLocalPart,
  resolveDemoCustomerName,
} from '../lib/demo-customer-name';
import {
  buildReminder24hContentVariables,
  formatReminder1h,
  formatReminder24h,
} from '../lib/demo-reminder-messages';

// --- resolve priority ---
assert.equal(
  resolveDemoCustomerName({ formName: 'Ana Pérez', conversationName: 'Lead WhatsApp' }),
  'Ana Pérez',
  'landing form wins',
);
assert.equal(
  resolveDemoCustomerName({
    conversationName: 'Miguel Ramirez',
    pendingName: 'Lead WhatsApp',
  }),
  'Miguel Ramirez',
  'conversation name wins over placeholder pending',
);
assert.equal(
  resolveDemoCustomerName({
    pendingName: 'Lead WhatsApp',
    messageExtractedName: 'Miguel Angel Ramirez Asprilla',
  }),
  'Miguel Angel Ramirez Asprilla',
  'message extract used when pending is placeholder',
);
assert.equal(
  resolveDemoCustomerName({ pendingName: 'Lead WhatsApp', toolName: 'Lead WhatsApp' }),
  DEMO_NAME_FALLBACK,
  'fallback Doctor/a when only placeholders',
);
assert.equal(
  resolveDemoCustomerName({ emailLocalPart: nameFromEmailLocalPart('miguelaramirez2222@gmail.com') }),
  DEMO_NAME_FALLBACK,
  'glued email local rejected → Doctor/a',
);
assert.equal(nameFromEmailLocalPart('miguel.ramirez@gmail.com'), 'Miguel');

assert.equal(isUsableDemoCustomerName('Lead WhatsApp'), false);
assert.equal(isUsableDemoCustomerName('lead whatsapp'), false);
assert.equal(isUsableDemoCustomerName('Miguel'), true);

// --- extract from messages (Miguel case) ---
const extracted = extractNameFromUserMessages([
  { role: 'user', content: 'Hola, me interesa conocer Kalyo' },
  {
    role: 'user',
    content: 'Miguel Angel Ramirez Asprilla \nmiguelaramirez2222@gmail.com',
  },
  { role: 'user', content: '1' },
]);
assert.equal(extracted, 'Miguel Angel Ramirez Asprilla');

assert.equal(
  extractNameFromUserMessages([{ role: 'user', content: 'Me llamo Carla López' }]),
  'Carla López',
);

// --- greetings ---
assert.equal(demoGreetingName('Miguel Angel Ramirez'), 'Miguel');
assert.equal(demoGreetingName('Lead WhatsApp'), DEMO_NAME_FALLBACK);
assert.equal(holaDemo('Miguel Angel'), 'Hola Miguel,');
assert.equal(holaDemo(null), 'Hola Doctor/a,');
assert.equal(holaDemo('Lead WhatsApp'), 'Hola Doctor/a,');

// --- reminder templates never say Lead WhatsApp ---
const demo = {
  id: 'd1',
  conversation_id: null,
  customer_name: 'Lead WhatsApp',
  customer_email: 'x@y.com',
  customer_phone: '+57300',
  scheduled_at: '2026-09-24T17:00:00.000Z',
  google_meet_link: 'https://meet.google.com/abc',
};
const display = { timezone: 'America/Bogota', label: 'Bogotá' };
const r24 = formatReminder24h(demo, display);
assert.doesNotMatch(r24, /Lead WhatsApp/i);
assert.match(r24, /Hola Doctor\/a,/);

const r1h = formatReminder1h(demo, display);
assert.doesNotMatch(r1h, /Lead WhatsApp/i);
assert.match(r1h, /Doctor\/a/);

const vars = buildReminder24hContentVariables(demo, display);
assert.ok(vars);
assert.equal(vars!['1'], DEMO_NAME_FALLBACK);
assert.doesNotMatch(vars!['1'], /Lead WhatsApp/i);

const good = formatReminder24h({ ...demo, customer_name: 'Miguel Angel Ramirez' }, display);
assert.match(good, /Hola Miguel,/);
assert.doesNotMatch(good, /Lead WhatsApp/i);

// WA with lead_name
assert.equal(
  resolveDemoCustomerName({ conversationName: 'Sofía Ruiz' }),
  'Sofía Ruiz',
);

console.log('demo-customer-name + reminder templates OK');
