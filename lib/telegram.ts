import 'server-only';

export type TelegramAlertResult = { sent: boolean; error?: string };

export async function sendTelegramAlert(text: string): Promise<TelegramAlertResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!token || !chatId) {
    console.warn('[telegram] missing TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID');
    return { sent: false, error: 'missing_env' };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('[telegram] alert send failed', response.status, body);
      return { sent: false, error: `${response.status}: ${body}` };
    }

    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[telegram] alert error', message);
    return { sent: false, error: message };
  }
}
