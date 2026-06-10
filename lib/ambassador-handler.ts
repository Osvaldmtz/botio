import type { SupabaseClient } from '@supabase/supabase-js';
import { detectAmbassadorIntent } from '@/lib/intent-detector';
import { buildAmbassadorReply } from '@/lib/ambassador-messages';
import { sendAmbassadorLeadTelegram } from '@/lib/telegram-notify';

const ADMIN_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'https://botio.dgx.agency';

export type AmbassadorConversationState = {
  isAmbassadorLead: boolean;
  webinarLinkSentAt: string | null;
  webinarRegistered: boolean;
  metadata: Record<string, unknown>;
};

export type AmbassadorHandlerResult = {
  replyText: string;
  source: 'ambassador_faq' | 'ambassador_guard';
  faqId?: string;
  sentLumaLink: boolean;
};

export async function loadAmbassadorState(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<AmbassadorConversationState> {
  const { data } = await supabase
    .from('conversations')
    .select('metadata, webinar_link_sent_at, webinar_registered')
    .eq('id', conversationId)
    .maybeSingle();

  const metadata = (data?.metadata as Record<string, unknown> | null) ?? {};

  return {
    isAmbassadorLead: metadata.is_ambassador_lead === true,
    webinarLinkSentAt: (data?.webinar_link_sent_at as string | null) ?? null,
    webinarRegistered: Boolean(data?.webinar_registered),
    metadata,
  };
}

export function shouldMarkAmbassadorLead(
  state: AmbassadorConversationState,
  messageBody: string,
): boolean {
  if (state.isAmbassadorLead) return false;
  return detectAmbassadorIntent(messageBody) === 'embajador_program';
}

export async function markAmbassadorLead(
  supabase: SupabaseClient,
  conversationId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const nextMetadata = {
    ...metadata,
    is_ambassador_lead: true,
    ambassador_detected_at: new Date().toISOString(),
  };

  await supabase
    .from('conversations')
    .update({
      metadata: nextMetadata,
      lead_intent: 'Embajadores',
    })
    .eq('id', conversationId);
}

export async function markWebinarLinkSent(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<void> {
  await supabase
    .from('conversations')
    .update({ webinar_link_sent_at: new Date().toISOString() })
    .eq('id', conversationId);
}

export async function notifyAmbassadorLead(params: {
  name?: string;
  phone: string;
  email?: string;
  conversationId: string;
  faqId?: string;
  webinarRegistered?: boolean;
}): Promise<void> {
  const convUrl = `${ADMIN_BASE_URL}/admin/conversations/${params.conversationId}`;
  await sendAmbassadorLeadTelegram({
    name: params.name,
    phone: params.phone,
    email: params.email,
    conversationUrl: convUrl,
    faqId: params.faqId,
    webinarRegistered: params.webinarRegistered ?? false,
  });
}

export function handleAmbassadorMessage(
  messageBody: string,
  state: AmbassadorConversationState,
): AmbassadorHandlerResult | null {
  return buildAmbassadorReply(messageBody, {
    webinarLinkSentAt: state.webinarLinkSentAt,
  });
}
