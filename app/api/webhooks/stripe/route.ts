import 'server-only';
import Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { markPaidByEmail } from '@/lib/conversation-outcome';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handleSubscriptionCreated(
  stripe: Stripe,
  subscription: Stripe.Subscription,
): Promise<number> {
  if (subscription.status === 'trialing') {
    console.log('[stripe-webhook] skip paid outcome | reason=trialing subscription');
    return 0;
  }

  if (subscription.status !== 'active') {
    console.log(
      `[stripe-webhook] skip paid outcome | reason=status_${subscription.status}`,
    );
    return 0;
  }

  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id;

  if (!customerId) return 0;

  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted || !customer.email) return 0;

  const supabase = createAdminClient();
  const updated = await markPaidByEmail(supabase, customer.email, 'stripe_webhook');
  console.log(
    `[stripe-webhook] subscription.created | email=${customer.email} | updated=${updated}`,
  );
  return updated;
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (!webhookSecret || !stripeKey) {
    return Response.json({ error: 'Stripe webhook not configured' }, { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2025-02-24.acacia' });
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return Response.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[stripe-webhook] signature verification failed', message);
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'customer.subscription.created') {
    try {
      const updated = await handleSubscriptionCreated(
        stripe,
        event.data.object as Stripe.Subscription,
      );
      return Response.json({ received: true, outcome_updated: updated });
    } catch (err) {
      console.error('[stripe-webhook] subscription.created handler failed', err);
      return Response.json({ error: 'Handler failed' }, { status: 500 });
    }
  }

  return Response.json({ received: true });
}
