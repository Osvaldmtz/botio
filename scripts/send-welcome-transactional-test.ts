/**
 * One-off: send transactional welcome test (no DB write).
 *   npx tsx scripts/send-welcome-transactional-test.ts
 */
import { config } from 'dotenv';
import { Resend } from 'resend';
import { personalizeTemplate } from '../lib/emailing/personalize';
import {
  WELCOME_TRANSACTIONAL_FROM,
  WELCOME_TRANSACTIONAL_HTML,
  WELCOME_TRANSACTIONAL_SUBJECT,
  WELCOME_UNSUBSCRIBE_HEADERS,
} from '../lib/emailing/templates/welcome-transactional';

config({ path: '.env.local', quiet: true });

async function main() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('Missing RESEND_API_KEY');

  const to = process.argv[2] || 'osvamtz@gmail.com';
  const name = process.argv[3] || 'Osvaldo';
  const html = personalizeTemplate(WELCOME_TRANSACTIONAL_HTML, name);

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: WELCOME_TRANSACTIONAL_FROM,
    to,
    subject: WELCOME_TRANSACTIONAL_SUBJECT,
    html,
    headers: { ...WELCOME_UNSUBSCRIBE_HEADERS },
  });

  if (error) {
    console.error(error);
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, to, subject: WELCOME_TRANSACTIONAL_SUBJECT, id: data?.id }, null, 2));
}

void main();
