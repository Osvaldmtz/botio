import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEMO_CONFIRMATION_TEMPLATE_SID,
  DEMO_CONFIRMATION_V2_TEMPLATE_SID,
  buildLandingDemoConfirmationContentVariables,
  buildLandingDemoConfirmationV2ContentVariables,
  deliverLandingDemoConfirmationWhatsApp,
} from './demo-booking-confirmation';

const creds = {
  accountSid: 'ACtest',
  authToken: 'token',
  from: 'whatsapp:+15550001111',
};

describe('landing demo confirmation whatsapp', () => {
  it('fills the approved template variables in Mexico time', () => {
    const variables = buildLandingDemoConfirmationContentVariables({
      name: 'Ana Pérez',
      scheduledAt: new Date('2026-10-02T15:00:00.000Z'),
      meetLink: 'https://meet.google.com/pgd-dxmb-sfk',
    });
    assert.equal(variables['1'], 'Ana');
    assert.equal(variables['2'], 'Viernes 2 de octubre');
    assert.equal(variables['3'], '9:00 a.m.');
    assert.equal(variables['4'], 'https://meet.google.com/pgd-dxmb-sfk');
  });

  it('skips WhatsApp when the number is blank', async () => {
    let calls = 0;
    const result = await deliverLandingDemoConfirmationWhatsApp({
      name: 'Ana Pérez',
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

  it('sends the confirmation template to the registered number', async () => {
    const sent: Array<{ to: string; contentSid?: string; contentVariables?: Record<string, string> }> =
      [];
    const result = await deliverLandingDemoConfirmationWhatsApp({
      name: 'Ana Pérez',
      whatsapp: '+573001112233',
      scheduledAt: new Date('2026-10-02T15:00:00.000Z'),
      meetLink: 'https://meet.google.com/pgd-dxmb-sfk',
      creds,
      sendFn: async (args) => {
        sent.push({
          to: args.to,
          contentSid: args.contentSid,
          contentVariables: args.contentVariables,
        });
      },
    });
    assert.equal(result, 'sent');
    assert.equal(sent.length, 1);
    assert.equal(sent[0]?.to, '+573001112233');
    assert.equal(sent[0]?.contentSid, DEMO_CONFIRMATION_V2_TEMPLATE_SID);
    assert.equal(sent[0]?.contentSid, 'HX5273e5777e114ab65abf03ce0658f44a');
    assert.notEqual(sent[0]?.contentSid, DEMO_CONFIRMATION_TEMPLATE_SID);
    assert.equal(sent[0]?.contentVariables?.['1'], 'Viernes 2 de octubre');
    assert.equal(sent[0]?.contentVariables?.['2'], '10:00 a.m.');
    assert.equal(sent[0]?.contentVariables?.['3'], 'hora Colombia');
  });

  it('maps v2 variables to date, time, and timezone', () => {
    const colombia = buildLandingDemoConfirmationV2ContentVariables({
      scheduledAt: new Date('2026-10-02T15:00:00.000Z'),
      phone: '+573001112233',
    });
    assert.equal(colombia['1'], 'Viernes 2 de octubre');
    assert.equal(colombia['2'], '10:00 a.m.');
    assert.equal(colombia['3'], 'hora Colombia');

    const mexico = buildLandingDemoConfirmationV2ContentVariables({
      scheduledAt: new Date('2026-10-02T15:00:00.000Z'),
      phone: '+525512345678',
    });
    assert.equal(mexico['2'], '9:00 a.m.');
    assert.equal(mexico['3'], 'CDMX');
  });
});
