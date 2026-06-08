export type SendTelegramFn = (text: string) => Promise<void>;

export type WelcomeMessageResult = {
  success: boolean;
  method: 'template' | 'plain_text' | 'none';
  sid?: string;
  reason?: string;
  error?: string;
};

function displayName(name: string | null | undefined, email: string): string {
  const trimmed = name?.trim();
  if (trimmed) return trimmed;
  return email.split('@')[0] ?? email;
}

export function buildTrialOnboardingTelegramText(params: {
  day: 1 | 3 | 7 | 13 | 15;
  name?: string | null;
  email: string;
  daysLeft?: number;
}): string {
  const name = displayName(params.name, params.email);
  const daysLeft =
    params.daysLeft !== undefined ? String(params.daysLeft) : '—';

  return (
    `📚 <b>Onboarding Día ${params.day} enviado</b>\n\n` +
    `Cliente: ${name}\n` +
    `Email: ${params.email}\n` +
    `Días restantes: ${daysLeft}`
  );
}

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

function formatWelcomeDeliveryLine(welcomeResult: WelcomeMessageResult | null | undefined): string {
  if (!welcomeResult) {
    return '📨 Mensaje bienvenida: omitido (sin credenciales Twilio o skipWhatsApp)';
  }

  if (welcomeResult.success) {
    const via =
      welcomeResult.method === 'template' ? 'template Meta' : 'texto plano';
    return `📨 Mensaje bienvenida: enviado vía ${via}`;
  }

  const via =
    welcomeResult.method === 'template'
      ? 'template Meta'
      : welcomeResult.method === 'plain_text'
        ? 'texto plano'
        : 'ninguno';
  const reason = welcomeResult.reason ?? welcomeResult.error ?? 'error desconocido';
  return (
    `📨 Mensaje bienvenida: <b>FALLÓ</b> vía ${via}\n` +
    `⚠️ Revisar manualmente al cliente — ${reason}`
  );
}

export function buildTrialEnrolledTelegramText(params: {
  name: string;
  email: string;
  phone: string;
  source: string;
  trialEndsAt: string;
  welcomeResult?: WelcomeMessageResult | null;
}): string {
  const trialDateStr = new Date(params.trialEndsAt).toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    `🎉 <b>Trial enrolado en Onboarding cron</b>\n\n` +
    `Cliente: ${params.name}\n` +
    `📱 WhatsApp: ${params.phone}\n` +
    `📧 Email: ${params.email}\n` +
    `📍 Source: ${params.source}\n` +
    `📅 Trial vence: ${trialDateStr}\n` +
    `${formatWelcomeDeliveryLine(params.welcomeResult)}\n\n` +
    `El cliente recibirá los 5 mensajes de onboarding en días 1, 3, 7, 13 y 15.`
  );
}

export async function notifyTrialEnrolled(params: {
  name: string;
  email: string;
  phone: string;
  source: string;
  trialEndsAt: string;
  welcomeResult?: WelcomeMessageResult | null;
  sendTelegram?: SendTelegramFn;
}): Promise<void> {
  const sendTelegram = params.sendTelegram ?? defaultSendTelegram;
  try {
    const text = buildTrialEnrolledTelegramText(params);
    await sendTelegram(text);
    console.log(`[trial-onboarding-webhook] telegram sent | email=${params.email}`);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[trial-onboarding-webhook] telegram failed | email=${params.email} | error=${error}`);
  }
}

export async function notifyTrialOnboardingSent(params: {
  day: 1 | 3 | 7 | 13 | 15;
  demoId: string;
  name?: string | null;
  email: string;
  trialEndsAt: string;
  sendTelegram?: SendTelegramFn;
}): Promise<void> {
  const sendTelegram = params.sendTelegram ?? defaultSendTelegram;
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(params.trialEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
  );

  try {
    const text = buildTrialOnboardingTelegramText({
      day: params.day,
      name: params.name,
      email: params.email,
      daysLeft,
    });
    await sendTelegram(text);
    console.log(
      `[trial-onboarding] telegram sent | day=${params.day} | id=${params.demoId}`,
    );
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(
      `[trial-onboarding] telegram failed | day=${params.day} | id=${params.demoId} | error=${error}`,
    );
  }
}
