import 'server-only';
import Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  handleActiveSubscriptionPaid,
  handleInvoicePaymentSucceeded,
} from '@/lib/stripe-paid-webhook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  const supabase = createAdminClient();

  try {
    if (event.type === 'customer.subscription.created') {
      const updated = await handleActiveSubscriptionPaid(
        supabase,
        stripe,
        event.data.object as Stripe.Subscription,
        event.type,
      );
      return Response.json({ received: true, outcome_updated: updated });
    }

    if (event.type === 'customer.subscription.updated') {
      const updated = await handleActiveSubscriptionPaid(
        supabase,
        stripe,
        event.data.object as Stripe.Subscription,
        event.type,
      );
      return Response.json({ received: true, outcome_updated: updated });
    }

    if (event.type === 'invoice.payment_succeeded') {
      const updated = await handleInvoicePaymentSucceeded(
        supabase,
        stripe,
        event.data.object as Stripe.Invoice,
      );
      return Response.json({ received: true, outcome_updated: updated });
    }
  } catch (err) {
    console.error(`[stripe-webhook] ${event.type} handler failed`, err);
    return Response.json({ error: 'Handler failed' }, { status: 500 });
  }

  return Response.json({ received: true });
}
