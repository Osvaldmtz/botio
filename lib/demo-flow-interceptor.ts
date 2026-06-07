import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { parseRelativeDate, parseTimeFromText } from '@/lib/calendar-slots';
import { loadPendingDemoSlots, type PendingDemoSlots } from '@/lib/demo-conversation';
import {
  executeCheckSpecificTime,
  executeConfirmDemoSlot,
  type DemoToolResult,
  type KalyoTwilioCreds,
} from '@/lib/demo-slot-actions';
import { parseSlotChoice } from '@/lib/demo-flow-parsing';
import {
  handleDemoReminderResponse,
  shouldInterceptDemoReminderResponse,
  type ActiveReminderDemo,
  type DemoReminderInterceptResult,
} from '@/lib/demo-reminder-response';

export {
  hasCustomTimeRequest,
  parseSlotChoice,
  parseReminderResponseChoice,
  shouldInterceptDemoConfirm,
  shouldInterceptDemoTimeCheck,
} from '@/lib/demo-flow-parsing';

export {
  handleDemoReminderResponse,
  shouldInterceptDemoReminderResponse,
  type ActiveReminderDemo,
  type DemoReminderInterceptResult,
};

export type DemoInterceptResult = {
  replyText: string;
  source: 'auto_demo_confirm' | 'auto_demo_check';
  toolResult: DemoToolResult;
  toolsCalled: string[];
};

function parseDateTimeFromMessage(text: string): { date: string; time: string } | null {
  const time = parseTimeFromText(text);
  if (!time) return null;

  const date = parseRelativeDate(text);
  if (!date) return null;

  return { date, time };
}

export async function loadConversationPending(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<PendingDemoSlots | null> {
  return loadPendingDemoSlots(supabase, conversationId);
}

export async function handleDemoConfirmInterception(params: {
  supabase: SupabaseClient;
  conversationId: string;
  messageBody: string;
  senderFrom: string;
  botId: string;
  creds: KalyoTwilioCreds;
  pending: PendingDemoSlots;
}): Promise<DemoInterceptResult> {
  const slotChoice = parseSlotChoice(params.messageBody, params.pending);
  if (!slotChoice) {
    throw new Error('handleDemoConfirmInterception called without valid slot choice');
  }

  const toolResult = await executeConfirmDemoSlot({
    supabase: params.supabase,
    conversationId: params.conversationId,
    slotNumber: slotChoice,
    customerEmail: params.pending.customer_email,
    customerName: params.pending.customer_name,
    senderFrom: params.senderFrom,
    botId: params.botId,
    creds: params.creds,
  });

  console.log(
    `[demo-flow] auto confirm slot=${slotChoice} conv=${params.conversationId} status=${toolResult.status}`,
  );

  return {
    replyText: toolResult.bot_message,
    source: 'auto_demo_confirm',
    toolResult,
    toolsCalled: ['confirm_demo_slot'],
  };
}

export async function handleDemoTimeCheckInterception(params: {
  supabase: SupabaseClient;
  conversationId: string;
  messageBody: string;
  senderFrom: string;
  pending: PendingDemoSlots;
}): Promise<DemoInterceptResult | null> {
  const parsed = parseDateTimeFromMessage(params.messageBody);
  if (!parsed) return null;

  const toolResult = await executeCheckSpecificTime({
    supabase: params.supabase,
    conversationId: params.conversationId,
    requestedDate: parsed.date,
    requestedTime: parsed.time,
    customerTimezone: params.pending.customer_timezone,
    senderFrom: params.senderFrom,
  });

  console.log(
    `[demo-flow] auto check_specific_time conv=${params.conversationId} status=${toolResult.status}`,
  );

  return {
    replyText: toolResult.bot_message,
    source: 'auto_demo_check',
    toolResult,
    toolsCalled: ['check_specific_time'],
  };
}
