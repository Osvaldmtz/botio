import type { SupabaseClient } from '@supabase/supabase-js';
import { cityToTimezone } from '@/lib/city-to-timezone';
import { parseReminderResponseChoice } from '@/lib/demo-flow-parsing';
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
  reminderResponse: 'confirmed' | 'reschedule_requested' | 'cancelled';
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
): Promise<ActiveReminderDemo | null> {
  if (parseReminderResponseChoice(messageBody) === null) return null;
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

export async function handleDemoReminderResponse(params: {
  supabase: SupabaseClient;
  conversationId: string;
  customerPhone: string;
  messageBody: string;
  demo: ActiveReminderDemo;
  creds: NotifySalesCreds | null;
  sendTelegram?: SendTelegramFn;
}): Promise<DemoReminderInterceptResult> {
  const choice = parseReminderResponseChoice(params.messageBody);
  if (!choice) {
    throw new Error('handleDemoReminderResponse called without valid reminder choice');
  }

  const display = await resolveDemoDisplayTimezone(params.supabase, params.demo);
  const notifyBase = {
    name: params.demo.customer_name,
    email: params.demo.customer_email,
    phone: params.customerPhone,
    whatsapp_number: params.customerPhone,
    conversationId: params.conversationId,
  };

  if (choice === 1) {
    const now = new Date().toISOString();
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

  if (choice === 2) {
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
      ...notifyBase,
      reason: 'demo_reschedule_requested',
      conversation_summary: 'Cliente pidió reagendar demo vía recordatorio WhatsApp',
    });

    await notifyDemoReminderEvent('customer_requested_reschedule', params.demo, {}, {
      supabase: params.supabase,
      display,
      sendTelegram: params.sendTelegram,
    });

    return {
      replyText,
      source: 'auto_demo_reminder',
      toolsCalled: ['schedule_demo'],
      reminderResponse: 'reschedule_requested',
    };
  }

  if (params.demo.google_event_id) {
    const { cancelDemoEvent } = await import('@/lib/google-calendar');
    await cancelDemoEvent(params.demo.id, 'cancelled_by_customer_via_reminder');
    await params.supabase
      .from('scheduled_demos')
      .update({ reminder_response: 'cancelled' })
      .eq('id', params.demo.id);
  } else {
    await params.supabase
      .from('scheduled_demos')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: 'cancelled_by_customer_via_reminder',
        reminder_response: 'cancelled',
      })
      .eq('id', params.demo.id);
  }

  console.log(`[demo-reminders] cancelled by customer | demo_id=${params.demo.id}`);

  await maybeNotifySales(params.creds, {
    ...notifyBase,
    reason: 'demo_cancelled_by_customer',
    conversation_summary: 'Cliente canceló demo vía recordatorio WhatsApp',
  });

  await notifyDemoReminderEvent(
    'customer_cancelled',
    params.demo,
    { cancellation_reason: 'cancelled_by_customer_via_reminder' },
    { supabase: params.supabase, display, sendTelegram: params.sendTelegram },
  );

  return {
    replyText:
      'Listo, tu demo fue cancelada. Si más adelante quieres reagendar, solo dime y la coordinamos. ¡Que tengas buen día!',
    source: 'auto_demo_reminder',
    toolsCalled: [],
    reminderResponse: 'cancelled',
  };
}
