import 'server-only';
import { sendLeadTelegram } from '@/lib/telegram-notify';

export { buildDemoSchedulingMessage, getDemoBookingUrl } from '@/lib/demo-booking-messages';

export async function notifyDemoLinkSent(input: {
  customerName?: string | null;
  phone: string;
  conversationId: string;
}): Promise<void> {
  const adminBase =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'https://botio.dgx.agency';
  const conversationUrl = `${adminBase}/admin/conversations/${input.conversationId}`;

  await sendLeadTelegram({
    name: input.customerName?.trim() || undefined,
    phone: input.phone,
    reason: 'demo_scheduled',
    conversation_summary:
      `📅 LINK DEMO ENVIADO (Calendly)\n` +
      `🔗 ${conversationUrl}\n` +
      `Esperando que el lead agende en Calendly.`,
  }).catch((err) => console.error('[demo-handler] telegram notify failed', err));
}
