import 'server-only';
import { sendTelegramAlert } from '@/lib/telegram';

const BILLING_EMAIL_TO = 'osvamtz@gmail.com';
const ALERT_COOLDOWN_MS = 5 * 60 * 1000;

let lastAlertAt = 0;

export function isAnthropicCreditBalanceError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : JSON.stringify(error ?? '');
  return /credit balance is too low/i.test(message);
}

async function sendBillingEmail(text: string): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[anthropic-billing] RESEND_API_KEY missing — skip email');
    return { sent: false, error: 'missing_resend' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Kalyo Alerts <hola@kalyo.io>',
        to: [BILLING_EMAIL_TO],
        subject: '🚨 Anthropic sin créditos — Sofía no puede responder',
        text,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('[anthropic-billing] email failed', response.status, body);
      return { sent: false, error: `${response.status}: ${body}` };
    }

    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[anthropic-billing] email error', message);
    return { sent: false, error: message };
  }
}

/**
 * Fire Telegram + email when Anthropic rejects for low credit balance.
 * Cooldown avoids flooding on burst failures within the same warm instance.
 */
export async function alertAnthropicCreditBalanceTooLow(
  error: unknown,
): Promise<void> {
  if (!isAnthropicCreditBalanceError(error)) return;

  const now = Date.now();
  if (now - lastAlertAt < ALERT_COOLDOWN_MS) {
    console.warn('[anthropic-billing] alert suppressed (cooldown)');
    return;
  }
  lastAlertAt = now;

  const detail =
    error instanceof Error ? error.message.slice(0, 400) : String(error).slice(0, 400);

  const text =
    `🚨 Anthropic credit balance too low\n` +
    `Sofía está enviando fallbacks — recargar créditos YA.\n` +
    `Console: https://console.anthropic.com/settings/billing\n` +
    `Detalle: ${detail}`;

  const [telegram, email] = await Promise.all([
    sendTelegramAlert(text),
    sendBillingEmail(text),
  ]);

  console.error('[anthropic-billing] alerts', {
    telegram: telegram.sent,
    email: email.sent,
    telegramError: telegram.error,
    emailError: email.error,
  });
}
