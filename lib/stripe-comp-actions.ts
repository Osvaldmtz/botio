import 'server-only';
import Stripe from 'stripe';
import { buildCompMetadata, isCompedSubscription } from '@/lib/stripe-comp';

export type CompSubscriptionResult = {
  ok: boolean;
  email: string;
  customer_id: string | null;
  subscription_id: string | null;
  previous_status: string | null;
  new_status: string | null;
  already_comped: boolean;
  message: string;
};

const COURTESY_COUPON_ID = 'comp_courtesy_100';

async function ensureCourtesyCoupon(stripe: Stripe): Promise<string> {
  try {
    const existing = await stripe.coupons.retrieve(COURTESY_COUPON_ID);
    return existing.id;
  } catch {
    const created = await stripe.coupons.create({
      id: COURTESY_COUPON_ID,
      percent_off: 100,
      duration: 'forever',
      name: 'Cortesía Kalyo (comp)',
    });
    return created.id;
  }
}

export function getStripeClient(): Stripe | null {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) return null;
  return new Stripe(secret, { apiVersion: '2025-02-24.acacia' });
}

/**
 * Marks a Stripe subscription as courtesy: 100% forever coupon, pause collection,
 * void open invoices, and set comp metadata.
 */
export async function compSubscriptionByEmail(
  stripe: Stripe,
  opts: {
    email: string;
    reason: string;
    by: string;
    subscriptionId?: string;
  },
): Promise<CompSubscriptionResult> {
  const email = opts.email.trim().toLowerCase();
  const customers = await stripe.customers.list({ email, limit: 5 });
  const customer = customers.data[0];
  if (!customer) {
    return {
      ok: false,
      email,
      customer_id: null,
      subscription_id: null,
      previous_status: null,
      new_status: null,
      already_comped: false,
      message: `No Stripe customer found for ${email}`,
    };
  }

  const subs = await stripe.subscriptions.list({
    customer: customer.id,
    status: 'all',
    limit: 20,
  });

  const preferred =
    (opts.subscriptionId
      ? subs.data.find((s) => s.id === opts.subscriptionId)
      : undefined) ??
    subs.data.find((s) => s.status === 'past_due') ??
    subs.data.find((s) => s.status === 'active') ??
    subs.data.find((s) => s.status === 'unpaid') ??
    subs.data[0];

  if (!preferred) {
    return {
      ok: false,
      email,
      customer_id: customer.id,
      subscription_id: null,
      previous_status: null,
      new_status: null,
      already_comped: false,
      message: `Customer ${customer.id} has no subscriptions`,
    };
  }

  if (isCompedSubscription(preferred)) {
    return {
      ok: true,
      email,
      customer_id: customer.id,
      subscription_id: preferred.id,
      previous_status: preferred.status,
      new_status: preferred.status,
      already_comped: true,
      message: 'Subscription already marked as comp',
    };
  }

  const previousStatus = preferred.status;
  const couponId = await ensureCourtesyCoupon(stripe);
  const meta = buildCompMetadata({ reason: opts.reason, by: opts.by });

  const openInvoices = await stripe.invoices.list({
    subscription: preferred.id,
    status: 'open',
    limit: 20,
  });
  for (const inv of openInvoices.data) {
    try {
      await stripe.invoices.voidInvoice(inv.id);
    } catch (err) {
      console.warn('[stripe-comp] void invoice failed', inv.id, err);
    }
  }

  // Flexible billing rejects legacy `coupon`; use `discounts` + pause collection.
  const updated = await stripe.subscriptions.update(preferred.id, {
    metadata: {
      ...preferred.metadata,
      ...meta,
    },
    discounts: [{ coupon: couponId }],
    pause_collection: { behavior: 'void' },
  });

  return {
    ok: true,
    email,
    customer_id: customer.id,
    subscription_id: preferred.id,
    previous_status: previousStatus,
    new_status: updated.status,
    already_comped: false,
    message: `Comped ${preferred.id} (${previousStatus} → ${updated.status})`,
  };
}
