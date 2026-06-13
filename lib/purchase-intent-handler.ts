import 'server-only';
import { detectPurchaseIntent } from '@/lib/purchase-intent-detector';

export type PurchaseIntentResult = {
  replyText: string;
  source: 'purchase_intent_max' | 'purchase_intent_pro' | 'purchase_intent_unknown';
};

const MAX_PAYMENT_LINK = 'https://buy.stripe.com/dRm7sK27CbJW7Jmf31gQE01';
const PRO_PAYMENT_LINK = 'https://buy.stripe.com/6oU5kCbIcaFS4xa7AzgQE00';
const DISCOUNT_CODE = 'PRIMER50';

const REPLY_MAX = `¡Excelente elección! 🎯 El plan Max es el más completo:

✓ 91+ evaluaciones clínicas con IA
✓ Reportes ejecutivos automáticos
✓ Agenda + Videollamadas Kalyo Meet
✓ Notas SOAP asistidas por IA
✓ Asistente de voz para sesiones
✓ Transcripción de 20 sesiones/mes
✓ Mapa de riesgo clínico

💳 Pagar plan Max ($39 USD/mes):
${MAX_PAYMENT_LINK}

🎁 ¿Quieres 50% off tu primer mes? Usa el cupón *${DISCOUNT_CODE}* al pagar.
Link directo con descuento:
${MAX_PAYMENT_LINK}?prefilled_promo_code=${DISCOUNT_CODE}`;

const REPLY_PRO = `¡Buena elección! 💼 El plan Pro tiene todo lo clínico:

✓ 91+ evaluaciones clínicas validadas
✓ Reportes automáticos con IA
✓ Mapa de riesgo clínico
✓ Alertas de deterioro en pacientes
✓ Soporte prioritario

💳 Pagar plan Pro ($29 USD/mes):
${PRO_PAYMENT_LINK}

🎁 ¿Quieres 50% off tu primer mes? Usa el cupón *${DISCOUNT_CODE}*:
${PRO_PAYMENT_LINK}?prefilled_promo_code=${DISCOUNT_CODE}`;

const REPLY_PAY_NOW = `¡Perfecto! 🎉 Tenemos 2 planes disponibles:

💎 *Plan Max* ($39/mes) — todo lo clínico + agenda + voz IA + videollamadas
💼 *Plan Pro* ($29/mes) — todo lo clínico

¿Cuál te interesa? Te paso el link directo.

(También puedes preguntarme cualquier duda antes de decidir 😊)`;

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
