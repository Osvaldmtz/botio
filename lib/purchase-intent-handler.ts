import 'server-only';
import { KALYO_PRICING } from '@/lib/kalyo-pricing-data';
import { detectPurchaseIntent } from '@/lib/purchase-intent-detector';

export type PurchaseIntentResult = {
  replyText: string;
  source: 'purchase_intent_max' | 'purchase_intent_pro' | 'purchase_intent_ultra' | 'purchase_intent_unknown';
};

const MAX_PAYMENT_LINK = KALYO_PRICING.max.payment_link;
const PRO_PAYMENT_LINK = KALYO_PRICING.pro.payment_link;

const REPLY_MAX = `¡Excelente elección! 🎯 El plan Max es el recomendado:

${KALYO_PRICING.max.features.slice(0, 6).map((f) => `✓ ${f}`).join('\n')}

💳 Pagar plan Max ($${KALYO_PRICING.max.price_monthly} USD/mes):
${MAX_PAYMENT_LINK}`;

const REPLY_PRO = `¡Buena elección! 💼 El plan Pro es la alternativa más básica:

${KALYO_PRICING.pro.features.slice(0, 5).map((f) => `✓ ${f}`).join('\n')}

Con $10 más, Max incluye agenda + videollamadas + transcripción de sesiones. ¿Seguro que prefieres Pro?

💳 Pagar plan Pro ($${KALYO_PRICING.pro.price_monthly} USD/mes):
${PRO_PAYMENT_LINK}`;

const REPLY_ULTRA = `⭐ Plan Ultra — $${KALYO_PRICING.ultra.price_monthly} USD/mes:

${KALYO_PRICING.ultra.features.map((f) => `✓ ${f}`).join('\n')}

Comparado con Max ($${KALYO_PRICING.max.price_monthly}/mes): Ultra agrega Sofía 24/7 en WhatsApp, agendamiento automático y cobro con tarjeta desde WhatsApp.

Para activar Ultra, escríbenos a hola@kalyo.io o revisa opciones en https://app.kalyo.io/pricing`;

const REPLY_PAY_NOW = `¡Perfecto! 🎉 Nuestros planes:

🚀 *Plan Max* ($${KALYO_PRICING.max.price_monthly}/mes) — recomendado: agenda + videollamadas + transcripción + todo Pro
💎 *Plan Pro* ($${KALYO_PRICING.pro.price_monthly}/mes) — más básico: evaluaciones ilimitadas + Kaly Voice + reportes IA

¿Cuál te interesa? Te paso el link directo.

Si aún no has probado, también puedes arrancar con *Max GRATIS 7 días* sin tarjeta. ¿Te activo el trial?`;

async function notifyPurchaseIntentTelegram(params: {
  plan: string;
  phone: string;
  customerName: string | null;
  conversationId: string;
}): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) return;

  const adminUrl = `https://team.kalyo.io/admin/conversations/${params.conversationId}`;
  const text =
    `💰 <b>INTENCIÓN DE COMPRA — Plan ${params.plan.toUpperCase()}</b>\n` +
    `👤 ${params.customerName ?? 'Desconocido'}\n` +
    `📱 ${params.phone}\n` +
    `🔗 <a href="${adminUrl}">Ver conversación</a>`;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  } catch (err) {
    console.error('[purchase-intent] telegram notify failed', err);
  }
}

export async function handlePurchaseIntentMessage(params: {
  messageBody: string;
  phone: string;
  customerName: string | null;
  conversationId: string;
  isAmbassadorLead: boolean;
  isTeamMember: boolean;
}): Promise<PurchaseIntentResult | null> {
  if (params.isAmbassadorLead || params.isTeamMember) return null;

  const intent = detectPurchaseIntent(params.messageBody);
  if (!intent.intent) return null;

  if (intent.intent === 'plan_ultra') {
    notifyPurchaseIntentTelegram({
      plan: 'Ultra',
      phone: params.phone,
      customerName: params.customerName,
      conversationId: params.conversationId,
    }).catch(() => {});

    return { replyText: REPLY_ULTRA, source: 'purchase_intent_ultra' };
  }

  if (intent.intent === 'plan_max') {
    notifyPurchaseIntentTelegram({
      plan: 'Max',
      phone: params.phone,
      customerName: params.customerName,
      conversationId: params.conversationId,
    }).catch(() => {});

    return { replyText: REPLY_MAX, source: 'purchase_intent_max' };
  }

  if (intent.intent === 'plan_pro') {
    notifyPurchaseIntentTelegram({
      plan: 'Pro',
      phone: params.phone,
      customerName: params.customerName,
      conversationId: params.conversationId,
    }).catch(() => {});

    return { replyText: REPLY_PRO, source: 'purchase_intent_pro' };
  }

  if (intent.intent === 'pay_now') {
    return { replyText: REPLY_PAY_NOW, source: 'purchase_intent_unknown' };
  }

  return null;
}
