import 'server-only';

export function getKalyoPublicBotToken(): string | undefined {
  return process.env.KALYO_PUBLIC_BOT_TOKEN;
}

export function isTelegramPublicConfigured(): boolean {
  return Boolean(getKalyoPublicBotToken());
}

export async function sendTelegramPublicMessage(
  chatId: number | string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  const token = getKalyoPublicBotToken();
  if (!token) {
    return { ok: false, error: 'KALYO_PUBLIC_BOT_TOKEN not configured' };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('[telegram-public] send failed', response.status, body);
      return { ok: false, error: body };
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[telegram-public] send error', message);
    return { ok: false, error: message };
  }
}
