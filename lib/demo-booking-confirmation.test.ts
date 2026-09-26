import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  deliverLandingDemoConfirmationWhatsApp,
  formatLandingDemoConfirmationWhatsApp,
} from './demo-booking-confirmation';

const creds = {
  accountSid: 'ACtest',
  authToken: 'token',
  from: 'whatsapp:+15550001111',
};

describe('landing demo confirmation whatsapp', () => {
  it('includes date, time, and meet link', () => {
    const body = formatLandingDemoConfirmationWhatsApp({
      scheduledAt: new Date('2026-10-02T15:00:00.000Z'),
      phone: '+573001112233',
      meetLink: 'https://meet.google.com/pgd-dxmb-sfk',
    });
    assert.match(body, /2 oct/i);
    assert.match(body, /Meet: https:\/\/meet\.google\.com\/pgd-dxmb-sfk/);
    assert.match(body, /\d{1,2}:\d{2}/);
  });

  it('skips WhatsApp when the number is blank', async () => {
    let calls = 0;
    const result = await deliverLandingDemoConfirmationWhatsApp({
      whatsapp: '   ',
      scheduledAt: new Date('2026-10-02T15:00:00.000Z'),
      meetLink: 'https://meet.google.com/pgd-dxmb-sfk',
      creds,
      sendFn: async () => {
        calls += 1;
      },
    });
    assert.equal(result, 'skipped_no_phone');
    assert.equal(calls, 0);
  });

  it('sends the confirmation body to the registered number', async () => {
    const sent: Array<{ to: string; body?: string }> = [];
    const result = await deliverLandingDemoConfirmationWhatsApp({
      whatsapp: '+573001112233',
      scheduledAt: new Date('2026-10-02T15:00:00.000Z'),
      meetLink: 'https://meet.google.com/abc-defg-hij',
      creds,
      sendFn: async (args) => {
        sent.push({ to: args.to, body: args.body });
      },
    });
    assert.equal(result, 'sent');
    assert.equal(sent.length, 1);
    assert.equal(sent[0]?.to, '+573001112233');
    assert.match(sent[0]?.body ?? '', /Meet: https:\/\/meet\.google\.com\/abc-defg-hij/);
  });
});
