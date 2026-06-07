export type SendTelegramFn = (text: string) => Promise<void>;

async function defaultSendTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) return;

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status}: ${body}`);
  }
}

export function buildPriceInsistenceTelegram(params: {
  name?: string | null;
  email?: string | null;
  triggerMessage: string;
}): string {
  const name = params.name?.trim() || '—';
  const email = params.email?.trim() || '—';
  return (
    `⚠️ <b>Lead INSISTE en precio</b>\n\n` +
    `Cliente: ${name}\n` +
    `Email: ${email}\n` +
    `Trigger: ${params.triggerMessage}\n\n` +
    `Cliente necesita atención manual o negociación.`
  );
}

export function buildCompetitionTelegram(params: {
  name?: string | null;
  email?: string | null;
  triggerMessage: string;
}): string {
  const name = params.name?.trim() || '—';
  const email = params.email?.trim() || '—';
  return (
    `⚔️ <b>Lead con competencia activa</b>\n\n` +
    `Cliente: ${name}\n` +
    `Email: ${email}\n` +
    `Trigger: ${params.triggerMessage}\n\n` +
    `Buena oportunidad de switch — considerar contacto personal.`
  );
}

export async function notifyObjectionTelegram(params: {
  kind: 'price_insistence' | 'competition';
  name?: string | null;
  email?: string | null;
  triggerMessage: string;
  sendTelegram?: SendTelegramFn;
}): Promise<void> {
  const sendTelegram = params.sendTelegram ?? defaultSendTelegram;
  const text =
    params.kind === 'price_insistence'
      ? buildPriceInsistenceTelegram(params)
      : buildCompetitionTelegram(params);

  try {
    await sendTelegram(text);
    console.log(`[objection-detected] telegram sent | kind=${params.kind}`);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[objection-detected] telegram failed | kind=${params.kind} | error=${error}`);
  }
}
