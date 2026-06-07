import 'server-only';
import { sendWhatsApp } from '@/lib/twilio';
import { normalizePhone } from '@/lib/phone';
import { sendLeadTelegram } from '@/lib/telegram-notify';
import { enrichLead, type ConversationMessage, type EnrichedLead } from '@/lib/lead-enrichment';
import { createAdminClient } from '@/lib/supabase/admin';

export type NotifySalesInput = {
  title?: string;
  name?: string;
  phone?: string;
  email?: string;
  expires_at?: string;
  preferred_time?: string;
  reason?: string;
  conversation_summary?: string;
  whatsapp_number?: string;
  conversationId?: string;
  conversationMessages?: ConversationMessage[];
};

export type NotifySalesCreds = {
  accountSid: string;
  authToken: string;
  from: string;
};

export type NotifySalesResult = { status: 'success' } | { status: 'error'; message: string };

function clean(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

const WHATSAPP_HEADERS: Record<string, string> = {
  requested_human: '🙋 Lead pidió hablar con humano',
  purchase_intent: '💰 Intención de compra',
  new_lead: '📬 Nuevo lead Kalyo',
  escalation: '⚠️ Escalación de conversación',
  activate_trial: '🎁 Trial Pro activado',
};

const TEMPERATURE_EMOJI: Record<EnrichedLead['temperature'], string> = {
  hot: '🔥',
  warm: '🟡',
  cold: '❄️',
};

async function loadConversationMessages(conversationId: string): Promise<ConversationMessage[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[kalyo-notify] failed to load conversation messages', { conversationId, error });
    return [];
  }
  return (data ?? []) as ConversationMessage[];
}

async function persistLeadEnrichment(
  conversationId: string,
  enriched: EnrichedLead,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('conversations')
    .update({
      lead_score: enriched.score,
      lead_temperature: enriched.temperature,
      lead_country: enriched.country,
      lead_city: enriched.city ?? null,
      lead_intent: enriched.intent,
      lead_signals: enriched.signals,
      enriched_at: new Date().toISOString(),
    })
    .eq('id', conversationId);
  if (error) {
    console.error('[kalyo-notify] failed to persist lead enrichment', { conversationId, error });
  }
}

function buildWhatsAppBody(
  reason: string | undefined,
  name: string | undefined,
  phone: string | undefined,
  email: string | undefined,
  summary: string | undefined,
  dateStr: string,
  expiresStr: string,
  enriched?: EnrichedLead,
): string {
  const header = enriched
    ? `${TEMPERATURE_EMOJI[enriched.temperature]} Lead ${enriched.temperature.toUpperCase()} — ${WHATSAPP_HEADERS[reason ?? ''] ?? 'Notificación Kalyo'}`
    : (WHATSAPP_HEADERS[reason ?? ''] ?? '📬 Notificación Kalyo');

  const location = enriched
    ? enriched.city
      ? `${enriched.city}, ${enriched.country}`
      : enriched.country
    : undefined;

  const lines = [
    header,
    `Nombre: ${name ?? '—'}`,
    `Teléfono: ${phone ?? '—'}`,
    `Email: ${email ?? '—'}`,
    `Fecha: ${dateStr}`,
  ];

  if (enriched) {
    lines.push(
      `Ubicación: ${location}`,
      `Score: ${enriched.score}/100`,
      `Interés: ${enriched.intent}`,
      `Señales: ${enriched.signals.join(', ') || '—'}`,
      `Acción: ${enriched.recommendedAction}`,
    );
  }

  if (reason === 'activate_trial' && expiresStr !== '—') {
    lines.push(`Vence: ${expiresStr}`);
  }
  if (summary) lines.push(`Resumen: ${summary}`);
  return lines.join('\n');
}

export async function notifySalesTeam(
  input: NotifySalesInput,
  creds: NotifySalesCreds,
): Promise<NotifySalesResult> {
  const name = clean(input.name);
  const explicitPhone = clean(input.phone);
  const whatsappNumber = normalizePhone(input.whatsapp_number);
  const phone = explicitPhone ?? whatsappNumber;
  const email = clean(input.email);

  if (!name && !phone && !email) {
    return { status: 'error', message: 'At least one of name, phone, or email is required' };
  }

  const salesPhone = process.env.KALYO_SALES_PHONE;
  if (!salesPhone) {
    console.error('[kalyo-notify] KALYO_SALES_PHONE not configured');
    return { status: 'error', message: 'Sales phone not configured' };
  }

  const reason = clean(input.reason);
  const summary = clean(input.conversation_summary);
  const expiresAt = clean(input.expires_at);

  let messages = input.conversationMessages ?? [];
  if (messages.length === 0 && input.conversationId) {
    messages = await loadConversationMessages(input.conversationId);
  }

  const enriched = enrichLead({
    phone: phone ?? '',
    conversationMessages: messages,
    email,
    name,
  });

  console.log(
    `[lead-enrichment] phone=${phone ?? '—'} score=${enriched.score} temperature=${enriched.temperature}`,
  );

  if (input.conversationId) {
    await persistLeadEnrichment(input.conversationId, enriched);
  }

  const localeOpts: Intl.DateTimeFormatOptions = {
    timeZone: enriched.timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  const dateStr = new Date().toLocaleString('es-MX', localeOpts);
  const expiresStr = expiresAt ? new Date(expiresAt).toLocaleString('es-MX', localeOpts) : '—';

  console.log('[kalyo-notify] notifying sales team', {
    salesPhone,
    name: name ?? '—',
    phone: phone ?? '—',
    email: email ?? '—',
    reason: reason ?? '—',
    score: enriched.score,
    temperature: enriched.temperature,
  });

  const whatsAppBody = buildWhatsAppBody(
    reason,
    name,
    phone,
    email,
    summary,
    dateStr,
    expiresStr,
    enriched,
  );

  console.log('[kalyo-notify] about to call Promise.allSettled for both channels');
  const [waResult, tgResult] = await Promise.allSettled([
    sendWhatsApp({
      accountSid: creds.accountSid,
      authToken: creds.authToken,
      from: creds.from,
      to: salesPhone,
      body: whatsAppBody,
    }),
    sendLeadTelegram({
      name,
      phone,
      email,
      reason,
      conversation_summary: summary,
      expires_at: expiresAt,
      enriched,
    }),
  ]);

  console.log('[kalyo-notify] Promise.allSettled done | wa:', waResult.status, '| tg:', tgResult.status);

  if (waResult.status === 'fulfilled') {
    console.log('[kalyo-notify] WhatsApp: success');
  } else {
    console.error('[kalyo-notify] WhatsApp: failed', waResult.reason);
  }

  if (tgResult.status === 'rejected') {
    console.error('[telegram-notify] Telegram: failed (rejected)', tgResult.reason);
  } else if (!tgResult.value.success) {
    console.error('[telegram-notify] Telegram: failed', tgResult.value.error);
  } else {
    console.log('[telegram-notify] Telegram: success');
  }

  const waOk = waResult.status === 'fulfilled';
  const tgOk = tgResult.status === 'fulfilled' && tgResult.value.success;

  if (!waOk && !tgOk) {
    const waMsg = waResult.status === 'rejected' ? String(waResult.reason) : 'WhatsApp send error';
    return { status: 'error', message: `Both channels failed. WhatsApp: ${waMsg}` };
  }

  return { status: 'success' };
}
