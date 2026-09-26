import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEMO_REMINDER_1H_TEMPLATE_SID,
  DEMO_REMINDER_24H_TEMPLATE_SID,
} from './demo-reminder-messages';
import { runDemoRemindersCron, type TwilioCreds } from './demo-reminders-cron';

type Row = Record<string, unknown>;

function createMockSupabase(tables: Record<string, Row[]>) {
  return {
    from(tableName: string) {
      const source = tables[tableName] ?? [];
      let matches = source;
      let patch: Row | null = null;
      const api = {
        select() {
          return api;
        },
        eq(col: string, val: unknown) {
          matches = matches.filter((row) => row[col] === val);
          return api;
        },
        is(col: string, val: unknown) {
          matches = matches.filter((row) => (row[col] ?? null) === val);
          return api;
        },
        in(col: string, vals: unknown[]) {
          matches = matches.filter((row) => vals.includes(row[col]));
          return api;
        },
        gte(col: string, val: string) {
          matches = matches.filter((row) => String(row[col]) >= val);
          return api;
        },
        lte(col: string, val: string) {
          matches = matches.filter((row) => String(row[col]) <= val);
          return api;
        },
        update(next: Row) {
          patch = next;
          return api;
        },
        insert() {
          return Promise.resolve({ error: null });
        },
        then(
          resolve: (value: { data: Row[]; error: null }) => void,
          reject?: (err: unknown) => void,
        ) {
          try {
            if (patch) {
              for (const row of matches) Object.assign(row, patch);
            }
            resolve({ data: matches.map((row) => ({ ...row })), error: null });
          } catch (err) {
            reject?.(err);
          }
        },
      };
      return api;
    },
  };
}

const creds: TwilioCreds = {
  accountSid: 'ACtest',
  authToken: 'token',
  from: 'whatsapp:+15550001111',
};

describe('demo booking reminders', () => {
  it('sends 24h and 1h templates, and telegrams the admin when WhatsApp is missing', async () => {
    const in24h = new Date(Date.now() + 23.5 * 60 * 60 * 1000).toISOString();
    const in1h = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const meet = 'https://meet.google.com/pgd-dxmb-sfk';
    const tables = {
      scheduled_demos: [] as Row[],
      demo_bookings: [
        {
          id: 'book-24',
          name: 'Ana Pérez',
          email: 'ana@example.com',
          whatsapp: '+573001112233',
          scheduled_at: in24h,
          meet_link: meet,
          google_meet_link: meet,
          status: 'confirmed',
          reminder_24h_sent: false,
          reminder_1h_sent: false,
        },
        {
          id: 'book-1h',
          name: 'Luis Gómez',
          email: 'luis@example.com',
          whatsapp: '+525512345678',
          scheduled_at: in1h,
          meet_link: meet,
          google_meet_link: null,
          status: 'confirmed',
          reminder_24h_sent: false,
          reminder_1h_sent: false,
        },
        {
          id: 'book-nophone',
          name: 'Sin Tel',
          email: 'sin@example.com',
          whatsapp: '',
          scheduled_at: in24h,
          meet_link: meet,
          google_meet_link: meet,
          status: 'confirmed',
          reminder_24h_sent: false,
          reminder_1h_sent: false,
        },
        {
          id: 'book-cancelled',
          name: 'Cancelada',
          email: 'no@example.com',
          whatsapp: '+573009998877',
          scheduled_at: in24h,
          meet_link: meet,
          google_meet_link: meet,
          status: 'cancelled',
          reminder_24h_sent: false,
          reminder_1h_sent: false,
        },
      ],
    };

    const sent: Array<{ to: string; contentSid?: string; contentVariables?: Record<string, string> }> =
      [];
    const telegrams: string[] = [];
    const supabase = createMockSupabase(tables);

    const summary = await runDemoRemindersCron({
      supabase: supabase as never,
      creds,
      sendFn: async (args) => {
        sent.push({
          to: args.to,
          contentSid: args.contentSid,
          contentVariables: args.contentVariables,
        });
      },
      sendTelegram: async (text) => {
        telegrams.push(text);
      },
    });

    assert.equal(summary.bookingsSent24h, 1);
    assert.equal(summary.bookingsSent1h, 1);
    assert.equal(summary.sent24h, 0);
    assert.equal(sent.length, 2);

    const sent24 = sent.find((message) => message.to === '+573001112233');
    assert.equal(sent24?.contentSid, DEMO_REMINDER_24H_TEMPLATE_SID);
    assert.equal(sent24?.contentVariables?.['3'], meet);

    const sent1h = sent.find((message) => message.to === '+525512345678');
    assert.equal(sent1h?.contentSid, DEMO_REMINDER_1H_TEMPLATE_SID);
    assert.equal(sent1h?.contentVariables?.['2'], meet);

    assert.equal(tables.demo_bookings.find((row) => row.id === 'book-24')?.reminder_24h_sent, true);
    assert.equal(tables.demo_bookings.find((row) => row.id === 'book-1h')?.reminder_1h_sent, true);
    assert.equal(
      tables.demo_bookings.find((row) => row.id === 'book-nophone')?.reminder_24h_sent,
      true,
    );
    assert.equal(
      tables.demo_bookings.find((row) => row.id === 'book-cancelled')?.reminder_24h_sent,
      false,
    );

    assert.equal(
      telegrams.some((text) => text.includes('Recordatorio 24h enviado') && text.includes('Ana')),
      true,
    );
    assert.equal(
      telegrams.some((text) => text.includes('Recordatorio 1h enviado') && text.includes('Luis')),
      true,
    );
    assert.equal(
      telegrams.some((text) => text.includes('sin WhatsApp') && text.includes('Sin Tel')),
      true,
    );

    sent.length = 0;
    telegrams.length = 0;
    const again = await runDemoRemindersCron({
      supabase: supabase as never,
      creds,
      sendFn: async (args) => {
        sent.push({ to: args.to, contentSid: args.contentSid });
      },
      sendTelegram: async (text) => {
        telegrams.push(text);
      },
    });
    assert.equal(again.bookingsSent24h, 0);
    assert.equal(again.bookingsSent1h, 0);
    assert.equal(sent.length, 0);
    assert.equal(telegrams.length, 0);
  });
});
