import type { SupabaseClient } from '@supabase/supabase-js';
import { detectObjection } from '@/lib/objection-detector';
import { formatObjectionResponse } from '@/lib/objection-responses';
import { notifyObjectionTelegram } from '@/lib/objection-notifications';

const EMAIL_RE = /[\w.+-]+@[\w.-]+\.\w+/i;
const NAME_SOY_RE = /(?:soy|me\s*llamo)\s+([A-Za-zÁÉÍÓÚáéíóúñÑ\s]{2,40})/i;

export type ObjectionInterceptResult = {
  replyText: string;
  source: 'objection_handler';
  objectionType: string;
  isRepeat: boolean;
};

export async function loadObjectionLeadContext(
  supabase: SupabaseClient,
  conversationId: string,
  messageMetadata?: Record<string, unknown>,
): Promise<{ name?: string; email?: string }> {
  if (typeof messageMetadata?.name === 'string' && messageMetadata.name.trim()) {
    const email =
      typeof messageMetadata.email === 'string' ? messageMetadata.email.trim() : undefined;
    return { name: messageMetadata.name.trim(), email };
  }

  const { data: messages } = await supabase
    .from('messages')
    .select('content, role')
    .eq('conversation_id', conversationId)
    .eq('role', 'user')
    .order('created_at', { ascending: false })
    .limit(25);

  let email: string | undefined;
  let name: string | undefined;

  for (const row of messages ?? []) {
    const content = row.content as string;
    if (!email) {
      const emailMatch = content.match(EMAIL_RE);
      if (emailMatch) email = emailMatch[0].toLowerCase();
    }
    if (!name) {
      const nameMatch = content.match(NAME_SOY_RE);
      if (nameMatch?.[1]) name = nameMatch[1].trim();
    }
    if (email && name) break;
  }

  return { name, email };
}

export async function handleObjectionMessage(params: {
  supabase: SupabaseClient;
  conversationId: string;
  customerPhone: string;
  messageBody: string;
  metadata?: Record<string, unknown>;
}): Promise<ObjectionInterceptResult | null> {
  const objection = await detectObjection(
    params.messageBody,
    { id: params.conversationId, customer_phone: params.customerPhone },
    params.supabase,
  );

  if (!objection) return null;

  const lead = await loadObjectionLeadContext(
    params.supabase,
    params.conversationId,
    params.metadata,
  );

  const responseText = formatObjectionResponse(objection.type, {
    name: lead.name ?? 'ahí',
    isRepeat: objection.is_repeat,
  });

  const insertOutcome =
    objection.type === 'price' && objection.is_repeat ? 'handoff' : 'pending';

  const { error: insertError } = await params.supabase.from('detected_objections').insert({
    conversation_id: params.conversationId,
    customer_phone: params.customerPhone,
    customer_email: lead.email ?? null,
    objection_type: objection.type,
    trigger_message: params.messageBody,
    response_used: responseText,
    outcome: insertOutcome,
    ...(insertOutcome === 'handoff' ? { resolved_at: new Date().toISOString() } : {}),
  });

  if (insertError) {
    console.error('[objection-detected] insert failed', insertError);
    return null;
  }

  if (objection.type === 'competition' && !objection.is_repeat) {
    await notifyObjectionTelegram({
      kind: 'competition',
      name: lead.name,
      email: lead.email,
      triggerMessage: params.messageBody,
    });
  }

  if (objection.type === 'price' && objection.is_repeat) {
    await notifyObjectionTelegram({
      kind: 'price_insistence',
      name: lead.name,
      email: lead.email,
      triggerMessage: params.messageBody,
    });
  }

  console.log(
    `[objection-detected] type=${objection.type} | conv=${params.conversationId} | is_repeat=${objection.is_repeat}`,
  );

  return {
    replyText: responseText,
    source: 'objection_handler',
    objectionType: objection.type,
    isRepeat: objection.is_repeat,
  };
}
