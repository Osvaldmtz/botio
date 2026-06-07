import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  checkSpecificTime,
  createDemoEvent,
  formatDemoConfirmationMessage,
} from '@/lib/google-calendar';
import {
  clearPendingDemoSlots,
  loadPendingDemoSlots,
  savePendingCustomSlot,
  savePendingDemoSlots,
} from '@/lib/demo-conversation';
import { notifySalesTeam } from '@/lib/kalyo-notify';
import { movePipelineStage } from '@/lib/pipeline-utils';
import { normalizeStage, STAGE_RANK } from '@/lib/pipeline';
import { recordOutcome } from '@/lib/ab-testing';

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
  creds: KalyoTwilioCreds;
}): Promise<DemoToolResult> {
  const { supabase, conversationId, slotNumber, senderFrom, botId, creds } = params;
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

  const { data: conv } = await supabase
    .from('conversations')
    .select('pipeline_stage, lead_score, lead_intent, lead_signals, bot_id')
    .eq('id', conversationId)
    .maybeSingle();

  try {
    const scheduledAt = new Date(slot.start);
    const result = await createDemoEvent({
      customerEmail: email || pending.customer_email,
      customerName: name || pending.customer_name,
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

    if (creds) {
      await notifySalesTeam(
        {
          name: name || pending.customer_name,
          email: email || pending.customer_email,
          phone: senderFrom,
          whatsapp_number: senderFrom,
          reason: 'demo_scheduled',
          preferred_time: slot.label_es,
          conversation_summary: `Demo agendada para ${slot.label_es}`,
          conversationId,
        },
        creds,
      );
    }

    await recordOutcome(supabase, conversationId, 'demo_scheduled', {
      demo_id: result.demoId,
      scheduled_at: slot.start,
    });

    return {
      status: 'success',
      demo_id: result.demoId,
      meet_link: result.meetLink,
      bot_message: formatDemoConfirmationMessage(
        scheduledAt,
        email || pending.customer_email,
        pending.customer_timezone ?? pending.display_timezone,
        pending.customer_city_label ?? pending.display_label,
      ),
    };
  } catch (err) {
    console.error('[confirm_demo_slot] failed', err);
    return {
      status: 'error',
      bot_message:
        'No pude confirmar ese horario. ¿Probamos con otro slot o consulto disponibilidad de nuevo?',
    };
  }
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
      if (pending) {
        await savePendingCustomSlot(supabase, conversationId, result.slot);
      }
    } else if (result.alternatives?.length && pending) {
      await savePendingDemoSlots(supabase, conversationId, {
        ...pending,
        slots: result.alternatives,
        custom: undefined,
      });
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
