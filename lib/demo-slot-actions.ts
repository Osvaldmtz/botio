import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  checkSpecificTime,
  createDemoEvent,
  formatDemoConfirmationMessage,
  isValidEmail,
} from '@/lib/google-calendar';
import {
  clearPendingDemoSlots,
  loadPendingDemoSlots,
  savePendingDemoSlots,
  type PendingDemoSlots,
} from '@/lib/demo-conversation';
import { pendingSlotsWithAlternatives } from '@/lib/demo-flow-parsing';
import { DemoSlotUnavailableError } from '@/lib/demo-availability';
import { validateDemoPhoneFormat } from '@/lib/demo-phone';
import { demoDisplayTimezone } from '@/lib/timezone-from-phone';
import {
  deliverDemoChannels,
  demoEmailSubject,
  renderDemoEmailHtml,
  sendDemoEmailViaResend,
} from '@/lib/demo-channel-delivery';
import { movePipelineStage } from '@/lib/pipeline-utils';
import { normalizeStage, STAGE_RANK } from '@/lib/pipeline';
import { recordOutcome } from '@/lib/ab-testing';
import {
  extractNameFromUserMessages,
  nameFromEmailLocalPart,
  readConversationDisplayName,
  resolveDemoCustomerName,
} from '@/lib/demo-customer-name';

export type KalyoTwilioCreds = {
  accountSid: string;
  authToken: string;
  from: string;
} | null;

export type DemoToolResult = {
  status: string;
  bot_message: string;
  [key: string]: unknown;
};

export async function executeConfirmDemoSlot(params: {
  supabase: SupabaseClient;
  conversationId: string;
  slotNumber: 1 | 2 | 3 | 'custom';
  customerEmail?: string;
  customerName?: string;
  senderFrom: string;
  botId: string;
  /** Kept for call-site compatibility; alerts now go via notifyDemoConfirmed. */
  creds?: KalyoTwilioCreds;
}): Promise<DemoToolResult> {
  const { supabase, conversationId, slotNumber, senderFrom, botId } = params;
  const phoneCheck = validateDemoPhoneFormat(senderFrom);
  if (!phoneCheck.ok) {
    return { status: 'invalid_phone', bot_message: phoneCheck.message };
  }
  const email = params.customerEmail?.trim() ?? '';
  const name = params.customerName?.trim() ?? '';

  const pending = await loadPendingDemoSlots(supabase, conversationId);
  if (!pending) {
    return {
      status: 'error',
      bot_message:
        'No tengo horarios pendientes. ¿Quieres que consulte disponibilidad de nuevo?',
    };
  }

  let slot;
  if (slotNumber === 'custom') {
    slot = pending.custom;
    if (!slot) {
      return {
        status: 'error',
        bot_message:
          'Primero verifico ese horario con check_specific_time. ¿Me confirmas el día y la hora?',
      };
    }
  } else {
    if (!pending.slots?.length) {
      return {
        status: 'error',
        bot_message:
          'No tengo horarios pendientes. ¿Quieres que consulte disponibilidad de nuevo?',
      };
    }
    slot = pending.slots[slotNumber - 1];
    if (!slot) {
      return {
        status: 'error',
        bot_message: 'Ese número no corresponde a un horario válido. Elige 1, 2 o 3.',
      };
    }
  }

  const resolvedEmail = (email || pending.customer_email || '').trim();

  const { data: conv } = await supabase
    .from('conversations')
    .select('pipeline_stage, lead_score, lead_intent, lead_signals, bot_id, metadata')
    .eq('id', conversationId)
    .maybeSingle();

  const metadata = (conv?.metadata as Record<string, unknown> | null) ?? {};
  const conversationName = readConversationDisplayName(metadata);

  let messageExtractedName: string | null = null;
  const { data: recentMsgs } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(40);
  if (recentMsgs?.length) {
    messageExtractedName = extractNameFromUserMessages(
      [...recentMsgs].reverse() as Array<{ role?: string; content?: string }>,
    );
  }

  const resolvedName = resolveDemoCustomerName({
    toolName: name,
    pendingName: pending.customer_name,
    conversationName,
    messageExtractedName,
    emailLocalPart: nameFromEmailLocalPart(resolvedEmail),
  });

  if (!isValidEmail(resolvedEmail)) {
    await savePendingDemoSlots(supabase, conversationId, {
      ...pending,
      custom: slot,
      customer_name: resolvedName,
      customer_phone: senderFrom,
    });
    return {
      status: 'need_email',
      bot_message:
        `Perfecto — dejo pendiente: ${slot.label_es}.\n\n` +
        '¿Me das tu email para enviarte la invitación de Google Meet?',
    };
  }

  try {
    const scheduledAt = new Date(slot.start);
    const result = await createDemoEvent({
      customerEmail: resolvedEmail,
      customerName: resolvedName,
      customerPhone: senderFrom,
      scheduledAt,
      botContext: {
        conversationId,
        botId: conv?.bot_id ?? botId,
        leadScore: conv?.lead_score,
        leadIntent: conv?.lead_intent,
        signals: Array.isArray(conv?.lead_signals) ? (conv.lead_signals as string[]) : null,
      },
    });

    await clearPendingDemoSlots(supabase, conversationId);

    const current = normalizeStage(conv?.pipeline_stage ?? 'new');
    if (current !== 'paid' && current !== 'lost' && STAGE_RANK.qualified > STAGE_RANK[current]) {
      await movePipelineStage(supabase, conversationId, current, 'qualified', null, 'auto');
    }

    // Telegram + email alerts fire inside createDemoEvent (notifyDemoConfirmed).

    await recordOutcome(supabase, conversationId, 'demo_scheduled', {
      demo_id: result.demoId,
      scheduled_at: slot.start,
    });

    const clock = demoDisplayTimezone(senderFrom, {
      timezone: pending.customer_timezone ?? pending.display_timezone,
      label: pending.customer_city_label ?? pending.display_label,
    });
    const botMessage = formatDemoConfirmationMessage(
      scheduledAt,
      resolvedEmail,
      clock.timezone,
      clock.label,
      result.meetLink,
    );
    const emailContent = {
      kind: 'confirmation' as const,
      name: resolvedName,
      scheduledAt,
      meetLink: result.meetLink,
      timezone: clock.timezone,
      timezoneLabel: clock.label,
    };
    const channels = await deliverDemoChannels({
      email: resolvedEmail,
      phone: senderFrom,
      sendEmail: () =>
        sendDemoEmailViaResend({
          to: resolvedEmail,
          subject: demoEmailSubject(emailContent),
          html: renderDemoEmailHtml(emailContent),
        }),
      sendWhatsApp: async () => {
        // The booking reply is the WhatsApp confirmation. Do not send a second template.
      },
    });
    const nowIso = new Date().toISOString();
    await supabase
      .from('scheduled_demos')
      .update({
        email_sent_at: channels.email === 'sent' ? nowIso : null,
        whatsapp_sent_at: channels.whatsapp === 'sent' ? nowIso : null,
        email_error: channels.emailError,
        whatsapp_error: channels.whatsappError,
      })
      .eq('id', result.demoId);
    if (channels.email === 'failed') {
      console.error(`[confirm_demo_slot] email failed | demo_id=${result.demoId} | ${channels.emailError}`);
    }

    return {
      status: 'success',
      demo_id: result.demoId,
      meet_link: result.meetLink,
      bot_message: botMessage,
    };
  } catch (err) {
    if (err instanceof DemoSlotUnavailableError) {
      return { status: 'unavailable', bot_message: err.message };
    }
    console.error('[confirm_demo_slot] failed', err);
    return {
      status: 'error',
      bot_message:
        'No pude confirmar ese horario. ¿Probamos con otro slot o consulto disponibilidad de nuevo?',
    };
  }
}

async function resolvePendingSlotIdentity(params: {
  supabase: SupabaseClient;
  conversationId: string;
  pending: PendingDemoSlots | null;
  customerTimezone: string;
  customerLabel?: string;
  senderFrom: string;
}): Promise<PendingDemoSlots> {
  const { pending } = params;
  let email = pending?.customer_email ?? '';
  let name = pending?.customer_name ?? '';
  let expiresAt = pending?.expires_at;

  if (!email || !name || !expiresAt) {
    const { data: demo } = await params.supabase
      .from('scheduled_demos')
      .select('customer_email, customer_name, scheduled_at')
      .eq('conversation_id', params.conversationId)
      .eq('status', 'scheduled')
      .order('scheduled_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    email = email || (typeof demo?.customer_email === 'string' ? demo.customer_email : '');
    name = name || (typeof demo?.customer_name === 'string' ? demo.customer_name : '');
    if (!expiresAt && typeof demo?.scheduled_at === 'string') {
      expiresAt = demo.scheduled_at;
    }
  }

  const label =
    params.customerLabel || pending?.customer_city_label || pending?.display_label || params.customerTimezone;

  return {
    slots: pending?.slots ?? [],
    custom: pending?.custom,
    customer_email: email,
    customer_name: name,
    customer_phone: pending?.customer_phone || params.senderFrom,
    customer_city: pending?.customer_city,
    customer_timezone: params.customerTimezone,
    customer_city_label: label,
    display_timezone: pending?.display_timezone || params.customerTimezone,
    display_label: pending?.display_label || label,
    offered_at: pending?.offered_at || new Date().toISOString(),
    ...(expiresAt ? { expires_at: expiresAt } : {}),
  };
}

export async function executeCheckSpecificTime(params: {
  supabase: SupabaseClient;
  conversationId: string;
  requestedDate: string;
  requestedTime: string;
  customerTimezone?: string;
  senderFrom: string;
}): Promise<DemoToolResult> {
  const { supabase, conversationId, requestedDate, requestedTime, senderFrom } = params;

  const pending = await loadPendingDemoSlots(supabase, conversationId);
  const customerTimezone = params.customerTimezone || pending?.customer_timezone;
  const customerLabel = pending?.customer_city_label ?? pending?.display_label;

  if (!customerTimezone) {
    return {
      status: 'error',
      bot_message:
        'Primero necesito saber tu ciudad para verificar horarios. ¿Desde qué ciudad nos escribes?',
    };
  }

  if (!requestedDate || !requestedTime) {
    return {
      status: 'error',
      bot_message: '¿Qué día y hora te gustaría? (ej: lunes 12:30)',
    };
  }

  try {
    const result = await checkSpecificTime({
      requestedDate,
      requestedTime,
      customerTimezone,
      customerLabel,
      customerPhone: senderFrom,
    });

    if (result.status === 'available' && result.slot) {
      const base = await resolvePendingSlotIdentity({
        supabase,
        conversationId,
        pending,
        customerTimezone,
        customerLabel,
        senderFrom,
      });
      await savePendingDemoSlots(supabase, conversationId, {
        ...base,
        custom: result.slot,
        slots: pending?.slots ?? base.slots,
      });
    } else if (result.alternatives?.length) {
      const identity = await resolvePendingSlotIdentity({
        supabase,
        conversationId,
        pending,
        customerTimezone,
        customerLabel,
        senderFrom,
      });
      const next = pendingSlotsWithAlternatives({
        existing: pending,
        alternatives: result.alternatives,
        identity,
        originalDemoAt: identity.expires_at ?? null,
        nowIso: new Date().toISOString(),
      });
      if (next) {
        await savePendingDemoSlots(supabase, conversationId, next);
      }
    }

    return result;
  } catch (err) {
    console.error('[check_specific_time] failed', err);
    return {
      status: 'error',
      bot_message: 'Tuve un problema consultando ese horario. ¿Lo intentamos de nuevo?',
    };
  }
}
