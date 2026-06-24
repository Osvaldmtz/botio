import 'server-only';
import { notifySalesTeam } from '@/lib/kalyo-notify';
import type { ConversationMessage } from '@/lib/lead-enrichment';

/** Assistant claims the sales team was notified without a tool call. */
const TEAM_NOTIFY_CLAIM_RE =
  /ya\s+avis[eé]|avis[eé]\s+al\s+equipo|equipo\s+(?:fue\s+)?notificado|notifiqu[eé]\s+al\s+equipo|equipo\s+se\s+comunicar[áa]|(?:el\s+)?equipo\s+(?:de\s+kalyo\s+)?(?:lo\s+)?(?:contactar[áa]|escribir[áa])/i;

export function looksLikeTeamNotifyClaim(text: string): boolean {
  return TEAM_NOTIFY_CLAIM_RE.test(text);
}

function buildConversationSummary(messages: ConversationMessage[]): string {
  const userLines = messages
    .filter((m) => m.role === 'user')
    .slice(-4)
    .map((m) => m.content.trim())
    .filter(Boolean);
  if (userLines.length === 0) return 'Lead pidió contacto con el equipo vía WhatsApp.';
  return userLines.join(' ').slice(0, 400);
}

function inferReason(replyText: string, userMessage: string): string {
  if (/precio|pago|pesos|d[oó]lar|costo/i.test(replyText + userMessage)) {
    return 'escalation';
  }
  return 'requested_human';
}

const NOTIFY_FAILED_REPLY =
  'Disculpa, tuve un problema técnico al notificar al equipo. ¿Puedes intentar de nuevo en un momento o escribir directo al +528114112000?';

export type EscalationNotifyGuardParams = {
  replyText: string;
  toolsCalled: string[];
  toolResults: Record<string, unknown>;
  conversationId: string;
  customerPhone: string;
  conversationMessages: ConversationMessage[];
  userMessage: string;
  bot: {
    twilio_account_sid: string | null;
    twilio_auth_token: string | null;
    twilio_whatsapp_number: string | null;
  };
};

export type EscalationNotifyGuardResult = {
  replyText: string;
  autoNotified: boolean;
  toolResult?: Record<string, unknown>;
};

export async function applyEscalationNotifyGuard(
  params: EscalationNotifyGuardParams,
): Promise<EscalationNotifyGuardResult> {
  const notifyResult = params.toolResults.notify_sales_team as { status?: string } | undefined;
  const notifySucceeded =
    params.toolsCalled.includes('notify_sales_team') && notifyResult?.status === 'success';

  if (notifySucceeded || !looksLikeTeamNotifyClaim(params.replyText)) {
    return { replyText: params.replyText, autoNotified: false };
  }

  const creds =
    params.bot.twilio_account_sid &&
    params.bot.twilio_auth_token &&
    params.bot.twilio_whatsapp_number
      ? {
          accountSid: params.bot.twilio_account_sid,
          authToken: params.bot.twilio_auth_token,
          from: params.bot.twilio_whatsapp_number,
        }
      : null;

  if (!creds) {
    console.error(
      `[escalation-notify-guard] missing Twilio creds — cannot auto-notify | conv=${params.conversationId}`,
    );
    return { replyText: NOTIFY_FAILED_REPLY, autoNotified: false };
  }

  console.error(
    `[escalation-notify-guard] LLM claimed team notified without successful notify_sales_team | conv=${params.conversationId}`,
  );

  const reason = inferReason(params.replyText, params.userMessage);
  const result = await notifySalesTeam(
    {
      whatsapp_number: params.customerPhone,
      phone: params.customerPhone,
      reason,
      conversation_summary: buildConversationSummary(params.conversationMessages),
      conversationId: params.conversationId,
      conversationMessages: params.conversationMessages,
    },
    creds,
  );

  if (result.status === 'success') {
    console.log(
      `[escalation-notify-guard] auto-notified sales team | conv=${params.conversationId} | reason=${reason}`,
    );
    return {
      replyText: params.replyText,
      autoNotified: true,
      toolResult: result as Record<string, unknown>,
    };
  }

  console.error(
    `[escalation-notify-guard] auto-notify failed | conv=${params.conversationId}`,
    result,
  );
  return { replyText: NOTIFY_FAILED_REPLY, autoNotified: false };
}
