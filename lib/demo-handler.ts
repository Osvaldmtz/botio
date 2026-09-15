import 'server-only';
import { sendLeadTelegram } from '@/lib/telegram-notify';

export { buildDemoSchedulingMessage, getDemoBookingUrl } from '@/lib/demo-booking-messages';

function conversationUrl(conversationId: string): string {
  const adminBase =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'https://botio.dgx.agency';
  return `${adminBase}/admin/conversations/${conversationId}`;
}

export async function notifyDemoLinkSent(input: {
  customerName?: string | null;
  phone: string;
  conversationId: string;
  reason?: string;
}): Promise<void> {
  const reasonNote = input.reason?.trim() || 'Esperando que el lead agende en kalyo.io/demo.';
  await sendLeadTelegram({
    name: input.customerName?.trim() || undefined,
    phone: input.phone,
    reason: 'demo_scheduled',
    conversation_summary:
      `📅 LINK DEMO ENVIADO\n` +
      `🔗 ${conversationUrl(input.conversationId)}\n` +
      reasonNote,
  }).catch((err) => console.error('[demo-handler] telegram notify failed', err));
}

export async function notifyDemoSlotsOffered(input: {
  customerName?: string | null;
  phone: string;
  conversationId: string;
  slotLabels: string[];
}): Promise<void> {
  const slotsPreview =
    input.slotLabels.length > 0
      ? input.slotLabels.map((label, i) => `${i + 1}. ${label}`).join('\n')
      : '(sin labels)';

  await sendLeadTelegram({
    name: input.customerName?.trim() || undefined,
    phone: input.phone,
    reason: 'demo_scheduled',
    conversation_summary:
      `📅 SLOTS OFRECIDOS\n` +
      `🔗 ${conversationUrl(input.conversationId)}\n` +
      slotsPreview,
  }).catch((err) => console.error('[demo-handler] telegram slots notify failed', err));
}
