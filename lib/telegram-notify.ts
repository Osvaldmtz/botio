import 'server-only';

export type TelegramNotifyInput = {
  name?: string;
  phone?: string;
  email?: string;
  reason?: string;
  conversation_summary?: string;
  expires_at?: string;
};

export type TelegramNotifyResult = { success: boolean; error?: string };

const REASON_HEADERS: Record<string, string> = {
  requested_human: '🙋 <b>Lead pidió hablar con humano</b>',
  purchase_intent: '💰 <b>Intención de compra</b>',
  new_lead: '📬 <b>Nuevo lead Kalyo</b>',
  escalation: '⚠️ <b>Escalación de conversación</b>',
  activate_trial: '🎁 <b>Trial Pro activado</b>',
};

const LOCALE_OPTS: Intl.DateTimeFormatOptions = {
  timeZone: 'America/Mexico_City',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

export async function sendLeadTelegram(
  input: TelegramNotifyInput,
): Promise<TelegramNotifyResult> {
  console.log('[telegram-notify] starting...');
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) {
    console.warn('[telegram-notify] missing env vars (TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID)');
    return { success: false, error: 'missing env vars' };
  }
  console.log('[telegram-notify] env vars present, sending...');

  const reason = input.reason?.trim() || 'new_lead';
  const header = REASON_HEADERS[reason] ?? '📬 <b>Notificación Kalyo</b>';

  const name = input.name?.trim() || '—';
  const phone = input.phone?.trim() || '—';
  const email = input.email?.trim() || '—';
  const summary = input.conversation_summary?.trim() || '—';
  const dateStr = new Date().toLocaleString('es-MX', LOCALE_OPTS);

  const expiresLine =
    reason === 'activate_trial' && input.expires_at
      ? `\n⏳ <b>Vence:</b> ${new Date(input.expires_at).toLocaleString('es-MX', LOCALE_OPTS)}`
      : '';

  // wa.me requires E.164 digits without the + prefix
  const waLine =
    phone !== '—'
      ? `\n<a href="https://wa.me/${phone.replace(/^\+/, '')}">Abrir chat WhatsApp</a>`
      : '';

  const text = [
    header,
    '',
    `👤 <b>Nombre:</b> ${name}`,
    `📱 <b>Teléfono:</b> ${phone}`,
    `📧 <b>Email:</b> ${email}`,
    `💬 <b>Resumen:</b> ${summary}`,
    `🕐 <b>Fecha:</b> ${dateStr}`,
    expiresLine,
    waLine,
  ]
    .filter((l) => l !== '')
    .join('\n');

  try {
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
      console.error('[telegram-notify] error', response.status, body);
      return { success: false, error: `${response.status}: ${body}` };
    }

    console.log('[telegram-notify] sent successfully');
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[telegram-notify] error', message);
    return { success: false, error: message };
  }
}
