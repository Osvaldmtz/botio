import 'server-only';
import Stripe from 'stripe';

export const runtime = 'nodejs';

async function sendTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) {
    console.warn('[stripe-past-due] missing TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID');
    return;
  }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  } catch (err) {
    console.error('[stripe-past-due] telegram send failed', err);
  }
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-02-24.acacia',
  });

  const subs = await stripe.subscriptions.list({
    status: 'past_due',
    limit: 100,
    expand: ['data.customer'],
  });

  type PastDueLead = {
    email: string | null;
    name: string | null;
    subscription_id: string;
    amount: number;
    past_due_since: Date;
  };

  const pastDueLeads: PastDueLead[] = subs.data.map((sub) => {
    const customer = sub.customer as Stripe.Customer;
    return {
      email: customer.email ?? null,
      name: customer.name ?? null,
      subscription_id: sub.id,
      amount: (sub.items.data[0]?.price?.unit_amount ?? 0) / 100,
      past_due_since: new Date(sub.current_period_end * 1000),
    };
  });

  console.log(`[stripe-past-due] found ${pastDueLeads.length} past_due subscriptions`);

  if (pastDueLeads.length > 0) {
    const rows = pastDueLeads
      .map(
        (l, i) =>
          `${i + 1}. <b>${l.name ?? 'Sin nombre'}</b> (${l.email ?? '?'})\n` +
          `   💰 $${l.amount}/mes — vencido desde ${l.past_due_since.toLocaleDateString('es-MX')}`,
      )
      .join('\n\n');

    const message =
      `⚠️ <b>ALERTA — ${pastDueLeads.length} suscripción(es) past_due</b>\n\n` +
      `${rows}\n\n` +
      `<i>Acción: contactar individualmente con incentivo de pago.</i>`;

    await sendTelegram(message);
  }

  return Response.json({
    past_due_count: pastDueLeads.length,
    leads: pastDueLeads,
  });
}
