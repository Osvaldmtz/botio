import type { SupabaseClient } from '@supabase/supabase-js';
import { cityToTimezone } from '@/lib/city-to-timezone';
import {
  clearPendingBookedConfirm,
  clearPendingDemoCancellation,
  clearPendingDemoSlots,
  loadPendingBookedConfirm,
  loadPendingDemoCancellation,
  loadPendingDemoSlots,
} from '@/lib/demo-conversation';
import {
  decideBookedConfirmReply,
  decideReminderAction,
  formatCancellationAsk,
  hasActivePendingSlots,
  type ReminderAction,
} from '@/lib/demo-flow-parsing';
import { normalizeStage, type PipelineStage } from '@/lib/pipeline';
import { movePipelineStage } from '@/lib/pipeline-stage-mutations';
import {
  formatReminderConfirmed,
  resolveDemoDisplayTimezone,
  type DemoReminderRow,
} from '@/lib/demo-reminder-messages';
import type { NotifySalesCreds, NotifySalesInput } from '@/lib/kalyo-notify';
import {
  notifyDemoReminderEvent,
  type SendTelegramFn,
} from '@/lib/demo-reminder-notifications';

export type ActiveReminderDemo = DemoReminderRow & {
  reminder_24h_sent_at: string | null;
  reminder_1h_sent_at: string | null;
  google_event_id: string | null;
  google_meet_link: string | null;
};

export type DemoReminderInterceptResult = {
  replyText: string;
  source: 'auto_demo_reminder';
  toolsCalled: string[];
  reminderResponse: 'confirmed' | 'reschedule_requested' | 'cancelled' | 'cancel_prompt';
};

const REMINDER_DEMO_SELECT =
  'id, conversation_id, customer_name, customer_email, customer_phone, scheduled_at, google_meet_link, reminder_24h_sent_at, reminder_1h_sent_at, google_event_id';

export async function findActiveReminderDemo(
  supabase: SupabaseClient,
  customerPhone: string,
): Promise<ActiveReminderDemo | null> {
  const now = new Date().toISOString();
  const horizon = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('scheduled_demos')
    .select(REMINDER_DEMO_SELECT)
    .eq('status', 'scheduled')
    .eq('customer_phone', customerPhone)
    .gt('scheduled_at', now)
    .lte('scheduled_at', horizon)
    .or('reminder_24h_sent_at.not.is.null,reminder_1h_sent_at.not.is.null')
    .order('scheduled_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as ActiveReminderDemo | null) ?? null;
}

export async function shouldInterceptDemoReminderResponse(
  supabase: SupabaseClient,
  customerPhone: string,
  messageBody: string,
  options?: { conversationId?: string },
): Promise<ActiveReminderDemo | null> {
  const conversationId = options?.conversationId;
  let slotsActive = false;
  let awaitingCancelReason = false;

  if (conversationId) {
    const [pending, cancellation] = await Promise.all([
      loadPendingDemoSlots(supabase, conversationId),
      loadPendingDemoCancellation(supabase, conversationId),
    ]);
    slotsActive = hasActivePendingSlots(pending);
    awaitingCancelReason = Boolean(cancellation);
  }

  const action = decideReminderAction({
    message: messageBody,
    hasActivePendingSlots: slotsActive,
    awaitingCancelReason,
  });
  if (action.kind === 'ignore') return null;
  return findActiveReminderDemo(supabase, customerPhone);
}

async function resolveTimezoneForReschedule(
  supabase: SupabaseClient,
  demo: ActiveReminderDemo,
): Promise<{ timezone: string; label: string; city?: string }> {
  const display = await resolveDemoDisplayTimezone(supabase, demo);
  if (demo.conversation_id) {
    const { data: conv } = await supabase
      .from('conversations')
      .select('lead_city')
      .eq('id', demo.conversation_id)
      .maybeSingle();
    const leadCity = typeof conv?.lead_city === 'string' ? conv.lead_city.trim() : '';
    if (leadCity) {
      const match = cityToTimezone(leadCity);
      if (match) {
        return {
          timezone: match.timezone,
          label: match.label,
          city: match.city_normalized,
        };
      }
    }
  }
  return { timezone: display.timezone, label: display.label };
}

async function offerRescheduleSlots(params: {
  supabase: SupabaseClient;
  demo: ActiveReminderDemo;
  customerPhone: string;
}): Promise<string> {
  const tz = await resolveTimezoneForReschedule(params.supabase, params.demo);

  const { getAvailableSlots } = await import('@/lib/google-calendar');
  const result = await getAvailableSlots({
    preferredDay: 'any',
    preferredTime: 'any',
    customerPhone: params.customerPhone,
    customerTimezone: tz.timezone,
    customerLabel: tz.label,
  });

  if (result.slots.length === 0) {
    return 'No encontré horarios disponibles en los próximos días. ¿Te funciona algún día de la próxima semana? Escríbeme y lo coordinamos.';
  }

  if (params.demo.conversation_id) {
    const { savePendingDemoSlots } = await import('@/lib/demo-conversation');
    await savePendingDemoSlots(params.supabase, params.demo.conversation_id, {
      slots: result.slots,
      customer_email: params.demo.customer_email,
      customer_name: params.demo.customer_name,
      customer_phone: params.customerPhone,
      customer_city: tz.city,
      customer_timezone: tz.timezone,
      customer_city_label: tz.label,
      display_timezone: tz.timezone,
      display_label: tz.label,
      offered_at: new Date().toISOString(),
      expires_at: params.demo.scheduled_at,
    });
  }

  const slotLines = result.slots.map((slot, i) => `${i + 1}️⃣ ${slot.label_es}`).join('\n');
  return (
    'Claro, te puedo reagendar. Aquí tienes nuevos horarios disponibles:\n' +
    `${slotLines}\n\n` +
    '¿Cuál te viene mejor? Responde con 1, 2 o 3.'
  );
}

async function maybeNotifySales(
  creds: NotifySalesCreds | null,
  input: NotifySalesInput,
): Promise<void> {
  if (!creds) return;
  const { notifySalesTeam } = await import('@/lib/kalyo-notify');
  await notifySalesTeam(input, creds);
}

async function applyCancellationPipeline(
  supabase: SupabaseClient,
  conversationId: string,
  target: 'lost' | 'qualified',
): Promise<PipelineStage> {
  const { data } = await supabase
    .from('conversations')
    .select('pipeline_stage')
    .eq('id', conversationId)
    .maybeSingle();
  const current = normalizeStage(
    typeof data?.pipeline_stage === 'string' ? data.pipeline_stage : 'new',
  );
  if (current === 'paid' || current === 'lost') return current;
  if (target === 'qualified') {
    if (current === 'qualified' || current === 'trial') return current;
    await movePipelineStage(supabase, conversationId, current, 'qualified', null, 'auto');
    return 'qualified';
  }
  await movePipelineStage(supabase, conversationId, current, 'lost', null, 'auto');
  return 'lost';
}

async function startReschedule(params: {
  supabase: SupabaseClient;
  conversationId: string;
  customerPhone: string;
  demo: ActiveReminderDemo;
  creds: NotifySalesCreds | null;
  sendTelegram?: SendTelegramFn;
  display: Awaited<ReturnType<typeof resolveDemoDisplayTimezone>>;
  notifyBase: NotifySalesInput;
}): Promise<DemoReminderInterceptResult> {
  await clearPendingDemoCancellation(params.supabase, params.conversationId);

  if (params.demo.google_event_id) {
    const { deleteDemoCalendarEvent } = await import('@/lib/google-calendar');
    await deleteDemoCalendarEvent(params.demo.google_event_id);
  }

  await params.supabase
    .from('scheduled_demos')
    .update({
      status: 'pending_reschedule',
      reminder_response: 'reschedule_requested',
      google_event_id: null,
      google_meet_link: null,
    })
    .eq('id', params.demo.id);

  console.log(`[demo-reminders] reschedule requested | demo_id=${params.demo.id}`);

  const replyText = await offerRescheduleSlots({
    supabase: params.supabase,
    demo: params.demo,
    customerPhone: params.customerPhone,
  });

  await maybeNotifySales(params.creds, {
    ...params.notifyBase,
    reason: 'demo_reschedule_requested',
    conversation_summary: 'Cliente pidió reagendar demo vía recordatorio WhatsApp',
  });

  await notifyDemoReminderEvent('customer_requested_reschedule', params.demo, {}, {
    supabase: params.supabase,
    display: params.display,
    sendTelegram: params.sendTelegram,
  });

  return {
    replyText,
    source: 'auto_demo_reminder',
    toolsCalled: ['schedule_demo'],
    reminderResponse: 'reschedule_requested',
  };
}

async function finalizeCancellation(params: {
  supabase: SupabaseClient;
  conversationId: string;
  demo: ActiveReminderDemo;
  creds: NotifySalesCreds | null;
  sendTelegram?: SendTelegramFn;
  display: Awaited<ReturnType<typeof resolveDemoDisplayTimezone>>;
  notifyBase: NotifySalesInput;
  action: Extract<ReminderAction, { kind: 'cancel' }>;
}): Promise<DemoReminderInterceptResult> {
  const reason = params.action.reason.slice(0, 500);

  if (params.demo.google_event_id) {
    const { cancelDemoEvent } = await import('@/lib/google-calendar');
    await cancelDemoEvent(params.demo.id, reason);
    await params.supabase
      .from('scheduled_demos')
      .update({ reminder_response: 'cancelled', cancellation_reason: reason })
      .eq('id', params.demo.id);
  } else {
    await params.supabase
      .from('scheduled_demos')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
        reminder_response: 'cancelled',
      })
      .eq('id', params.demo.id);
  }

  await clearPendingDemoCancellation(params.supabase, params.conversationId);
  await clearPendingDemoSlots(params.supabase, params.conversationId);

  const pipelineStage = await applyCancellationPipeline(
    params.supabase,
    params.conversationId,
    params.action.pipeline,
  );

  console.log(
    `[demo-reminders] cancelled by customer | demo_id=${params.demo.id} | pipeline=${pipelineStage}`,
  );

  await maybeNotifySales(params.creds, {
    ...params.notifyBase,
    reason: 'demo_cancelled_by_customer',
    conversation_summary: `Cliente canceló demo vía recordatorio WhatsApp. Motivo: ${reason}. Pipeline: ${pipelineStage}`,
  });

  await notifyDemoReminderEvent(
    'customer_cancelled',
    params.demo,
    { cancellation_reason: reason, pipeline_stage: pipelineStage },
    { supabase: params.supabase, display: params.display, sendTelegram: params.sendTelegram },
  );

  return {
    replyText:
      'Listo, tu demo fue cancelada. Si más adelante quieres reagendar, solo dime y la coordinamos. ¡Que tengas buen día!',
    source: 'auto_demo_reminder',
    toolsCalled: [],
    reminderResponse: 'cancelled',
  };
}

export async function handleDemoReminderResponse(params: {
  supabase: SupabaseClient;
  conversationId: string;
  customerPhone: string;
  messageBody: string;
  demo: ActiveReminderDemo;
  creds: NotifySalesCreds | null;
  sendTelegram?: SendTelegramFn;
}): Promise<DemoReminderInterceptResult> {
  const [pending, cancellation] = await Promise.all([
    loadPendingDemoSlots(params.supabase, params.conversationId),
    loadPendingDemoCancellation(params.supabase, params.conversationId),
  ]);
  const action = decideReminderAction({
    message: params.messageBody,
    hasActivePendingSlots: hasActivePendingSlots(pending),
    awaitingCancelReason: cancellation?.demo_id === params.demo.id,
  });
  if (action.kind === 'ignore') {
    throw new Error('handleDemoReminderResponse called without a reminder action');
  }

  const display = await resolveDemoDisplayTimezone(params.supabase, params.demo);
  const notifyBase: NotifySalesInput = {
    name: params.demo.customer_name,
    email: params.demo.customer_email,
    phone: params.customerPhone,
    whatsapp_number: params.customerPhone,
    conversationId: params.conversationId,
    reason: 'demo_confirmed_by_customer',
  };

  if (action.kind === 'ask_cancel') {
    await savePendingCancellation(params.supabase, params.conversationId, params.demo.id);
    console.log(`[demo-reminders] cancel prompt | demo_id=${params.demo.id}`);
    return {
      replyText: formatCancellationAsk(),
      source: 'auto_demo_reminder',
      toolsCalled: [],
      reminderResponse: 'cancel_prompt',
    };
  }

  if (action.kind === 'reschedule') {
    return startReschedule({ ...params, display, notifyBase });
  }

  if (action.kind === 'cancel') {
    return finalizeCancellation({ ...params, display, notifyBase, action });
  }

  const now = new Date().toISOString();
  await clearPendingDemoCancellation(params.supabase, params.conversationId);
  await params.supabase
    .from('scheduled_demos')
    .update({
      confirmed_by_customer_at: now,
      reminder_response: 'confirmed',
    })
    .eq('id', params.demo.id);

  console.log(
    `[demo-reminders] customer responded | demo_id=${params.demo.id} | response=confirmed`,
  );

  await maybeNotifySales(params.creds, {
    ...notifyBase,
    reason: 'demo_confirmed_by_customer',
    preferred_time: params.demo.scheduled_at,
    conversation_summary: `Cliente confirmó asistencia a demo del ${params.demo.scheduled_at}`,
  });

  await notifyDemoReminderEvent('customer_confirmed', params.demo, {}, {
    supabase: params.supabase,
    display,
    sendTelegram: params.sendTelegram,
  });

  return {
    replyText: formatReminderConfirmed(params.demo, display),
    source: 'auto_demo_reminder',
    toolsCalled: [],
    reminderResponse: 'confirmed',
  };
}

async function savePendingCancellation(
  supabase: SupabaseClient,
  conversationId: string,
  demoId: string,
): Promise<void> {
  const { savePendingDemoCancellation } = await import('@/lib/demo-conversation');
  await savePendingDemoCancellation(supabase, conversationId, {
    demo_id: demoId,
    asked_at: new Date().toISOString(),
  });
}

export async function maybeHandlePendingBookedConfirm(params: {
  supabase: SupabaseClient;
  conversationId: string;
  customerPhone: string;
  messageBody: string;
  creds: NotifySalesCreds | null;
  sendTelegram?: SendTelegramFn;
}): Promise<DemoReminderInterceptResult | null> {
  const pending = await loadPendingBookedConfirm(params.supabase, params.conversationId);
  if (!pending) return null;

  const decision = decideBookedConfirmReply(params.messageBody);
  if (decision === 'ignore') return null;

  const { data, error } = await params.supabase
    .from('scheduled_demos')
    .select(`${REMINDER_DEMO_SELECT}, status`)
    .eq('id', pending.demo_id)
    .maybeSingle();
  if (error) throw error;
  const demo = data as (ActiveReminderDemo & { status?: string }) | null;
  if (!demo || demo.status !== 'scheduled') {
    await clearPendingBookedConfirm(params.supabase, params.conversationId);
    return null;
  }

  if (decision === 'confirm') {
    const now = new Date().toISOString();
    await params.supabase
      .from('scheduled_demos')
      .update({
        confirmed_by_customer_at: now,
        reminder_response: 'confirmed',
      })
      .eq('id', demo.id);
    await clearPendingBookedConfirm(params.supabase, params.conversationId);
    return {
      replyText: `Listo. Queda confirmada: ${pending.slot_label}. Te llegará el recordatorio. ¡Nos vemos!`,
      source: 'auto_demo_reminder',
      toolsCalled: [],
      reminderResponse: 'confirmed',
    };
  }

  await clearPendingBookedConfirm(params.supabase, params.conversationId);
  const display = await resolveDemoDisplayTimezone(params.supabase, demo);
  return startReschedule({
    supabase: params.supabase,
    conversationId: params.conversationId,
    customerPhone: params.customerPhone,
    demo,
    creds: params.creds,
    sendTelegram: params.sendTelegram,
    display,
    notifyBase: {
      name: demo.customer_name,
      email: demo.customer_email,
      phone: params.customerPhone,
      whatsapp_number: params.customerPhone,
      conversationId: params.conversationId,
      reason: 'demo_reschedule_requested',
    },
  });
}

