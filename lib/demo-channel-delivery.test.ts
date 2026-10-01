import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  deliverDemoChannels,
  demoEmailSubject,
  renderDemoEmailHtml,
  KALYO_PRIMARY,
  KALYO_LOGO_URL,
} from './demo-channel-delivery';

const when = '2026-10-02T15:00:00.000Z';
const content = {
  name: 'Erika',
  scheduledAt: when,
  meetLink: 'https://meet.google.com/pgd-dxmb-sfk',
  timezone: 'America/Mexico_City',
  timezoneLabel: 'CDMX',
};

describe('demo email and WhatsApp together', () => {
  it('renders a branded confirmation with the customer clock and both actions', () => {
    const html = renderDemoEmailHtml({ ...content, kind: 'confirmation' });
    assert.equal(demoEmailSubject({ ...content, kind: 'confirmation' }), 'Tu demo de Kalyo está agendada ✅');
    assert.match(html, new RegExp(KALYO_PRIMARY));
    assert.match(html, new RegExp(KALYO_LOGO_URL.replace(/[.]/g, '\\.')));
    assert.match(html, /9:00 a\.m\. \(CDMX\)/);
    assert.match(html, /Entrar a la demo/);
    assert.match(html, /Reagendar/);
    assert.match(html, /Cancelar/);
    assert.match(html, /https:\/\/kalyo\.io\/demo/);
  });

  it('uses the 24h and 1h subjects', () => {
    assert.match(
      demoEmailSubject({ ...content, kind: 'reminder_24h' }),
      /Recordatorio: demo mañana a las/,
    );
    assert.equal(demoEmailSubject({ ...content, kind: 'reminder_1h' }), 'Tu demo empieza en 1 hora');
    const hour = renderDemoEmailHtml({ ...content, kind: 'reminder_1h' });
    assert.match(hour, /Da clic aquí para entrar|empieza en 1 hora/);
  });

  it('sends email and WhatsApp when both are available', async () => {
    const calls: string[] = [];
    const result = await deliverDemoChannels({
      email: 'erika@example.com',
      phone: '+527774288133',
      sendEmail: async () => {
        calls.push('email');
      },
      sendWhatsApp: async () => {
        calls.push('whatsapp');
      },
    });
    assert.deepEqual(calls.sort(), ['email', 'whatsapp']);
    assert.equal(result.email, 'sent');
    assert.equal(result.whatsapp, 'sent');
    assert.equal(result.alert, false);
  });

  it('still delivers WhatsApp when email fails', async () => {
    const result = await deliverDemoChannels({
      email: 'erika@example.com',
      phone: '+527774288133',
      sendEmail: async () => {
        throw new Error('resend down');
      },
      sendWhatsApp: async () => undefined,
    });
    assert.equal(result.email, 'failed');
    assert.equal(result.whatsapp, 'sent');
    assert.equal(result.alert, false);
    assert.equal(result.emailError, 'resend down');
  });

  it('delivers email and alerts when WhatsApp fails', async () => {
    const result = await deliverDemoChannels({
      email: 'ana@example.com',
      phone: '+573001112233',
      sendEmail: async () => undefined,
      sendWhatsApp: async () => {
        throw new Error('twilio down');
      },
    });
    assert.equal(result.email, 'sent');
    assert.equal(result.whatsapp, 'failed');
    assert.equal(result.alert, true);
  });

  it('alerts when both channels fail', async () => {
    const result = await deliverDemoChannels({
      email: 'ana@example.com',
      phone: '+573001112233',
      sendEmail: async () => {
        throw new Error('resend down');
      },
      sendWhatsApp: async () => {
        throw new Error('twilio down');
      },
    });
    assert.equal(result.email, 'failed');
    assert.equal(result.whatsapp, 'failed');
    assert.equal(result.alert, true);
  });

  it('sends only WhatsApp when there is no email', async () => {
    const result = await deliverDemoChannels({
      email: '',
      phone: '+573001112233',
      sendWhatsApp: async () => undefined,
    });
    assert.equal(result.email, 'skipped');
    assert.equal(result.whatsapp, 'sent');
    assert.equal(result.alert, false);
  });
});
