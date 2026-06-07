#!/usr/bin/env node
/**
 * Registers the Telegram public bot webhook with Botio.
 *
 * Usage:
 *   KALYO_PUBLIC_BOT_TOKEN=xxx KALYO_BOT_ID=64f6eed2-... node scripts/setup-telegram-public-bot.mjs
 *
 * Optional:
 *   BOTIO_BASE_URL=https://botio.dgx.agency (default)
 */

const token = process.env.KALYO_PUBLIC_BOT_TOKEN;
const botId =
  process.env.KALYO_BOT_ID ?? '64f6eed2-1522-48fe-a2c6-f858b767df06';
const baseUrl = (process.env.BOTIO_BASE_URL ?? 'https://botio.dgx.agency').replace(
  /\/$/,
  '',
);

if (!token) {
  console.error('Missing KALYO_PUBLIC_BOT_TOKEN');
  process.exit(1);
}

const webhookUrl = `${baseUrl}/api/telegram-webhook/${botId}`;

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: webhookUrl,
    allowed_updates: ['message'],
    drop_pending_updates: true,
  }),
});

const data = await res.json();

if (!data.ok) {
  console.error('setWebhook failed:', data);
  process.exit(1);
}

console.log('Telegram webhook configured:', webhookUrl);
console.log('Result:', data.description ?? 'OK');
