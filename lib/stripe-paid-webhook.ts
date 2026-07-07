import 'server-only';
import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { processCustomerPaid } from '@/lib/conversation-outcome';

const SUBSCRIPTION_INVOICE_REASONS = new Set([
  'subscription_create',
  'subscription_cycle',
  'subscription_update',
]);

export async function getStripeCustomerEmail(
  stripe: Stripe,
  customerId: string,
): Promise<string | null> {
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted || !customer.email) return null;
  return customer.email.trim().toLowerCase();
}

function readCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null {
  if (!customer) return null;
  return typeof customer === 'string' ? customer : customer.id;
}

export async function handleActiveSubscriptionPaid(
  supabase: SupabaseClient,
  stripe: Stripe,
  subscription: Stripe.Subscription,
  eventType: string,
): Promise<number> {
  if (subscription.status === 'trialing') {
    console.log(`[stripe-webhook] skip paid outcome | event=${eventType} | reason=trialing`);
    return 0;
  }

  if (subscription.status !== 'active') {
    console.log(
      `[stripe-webhook] skip paid outcome | event=${eventType} | reason=status_${subscription.status}`,
    );
    return 0;
  }

  const customerId = readCustomerId(subscription.customer);
  if (!customerId) return 0;

  const email = await getStripeCustomerEmail(stripe, customerId);
  if (!email) return 0;

  const result = await processCustomerPaid(supabase, email, 'stripe_webhook');
  console.log(
    `[stripe-webhook] ${eventType} | email=${email} | outcome_updated=${result.outcome_updated} | onboarding_updated=${result.onboarding_updated} | conversation_created=${result.conversation_created}`,
  );
  return result.outcome_updated;
}

export async function handleInvoicePaymentSucceeded(
  supabase: SupabaseClient,
  stripe: Stripe,
  invoice: Stripe.Invoice,
): Promise<number> {
  if (invoice.status !== 'paid' || (invoice.amount_paid ?? 0) <= 0) {
    return 0;
  }

  const billingReason = invoice.billing_reason ?? '';
  if (billingReason && !SUBSCRIPTION_INVOICE_REASONS.has(billingReason)) {
    console.log(
      `[stripe-webhook] skip invoice.payment_succeeded | reason=billing_${billingReason || 'unknown'}`,
    );
    return 0;
  }

  const customerId = readCustomerId(invoice.customer);
  if (!customerId) return 0;

  const email = await getStripeCustomerEmail(stripe, customerId);
  if (!email) return 0;

  const result = await processCustomerPaid(supabase, email, 'stripe_webhook');
  console.log(
    `[stripe-webhook] invoice.payment_succeeded | email=${email} | outcome_updated=${result.outcome_updated} | onboarding_updated=${result.onboarding_updated} | conversation_created=${result.conversation_created}`,
  );
  return result.outcome_updated;
}
