import 'server-only';
import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  markSubscriptionChurnedByEmail,
  processCustomerPaid,
  syncSubscriptionBillingMetadataByEmail,
} from '@/lib/conversation-outcome';
import { runWelcomePaidAutomation } from '@/lib/emailing/automations';
import { sendTelegramAlert } from '@/lib/telegram';

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
): Promise<{ outcome_updated: number; onboarding_updated: number }> {
  if (subscription.status === 'trialing') {
    console.log(`[stripe-webhook] skip paid outcome | event=${eventType} | reason=trialing`);
    return { outcome_updated: 0, onboarding_updated: 0 };
  }

  if (subscription.status !== 'active') {
    console.log(
      `[stripe-webhook] skip paid outcome | event=${eventType} | reason=status_${subscription.status}`,
    );
    return { outcome_updated: 0, onboarding_updated: 0 };
  }

  const customerId = readCustomerId(subscription.customer);
  if (!customerId) return { outcome_updated: 0, onboarding_updated: 0 };

  const email = await getStripeCustomerEmail(stripe, customerId);
  if (!email) return { outcome_updated: 0, onboarding_updated: 0 };

  const result = await processCustomerPaid(supabase, email, 'stripe_webhook', {
    subscriptionId: subscription.id,
  });

  try {
    const emailing = await runWelcomePaidAutomation({
      supabase,
      email,
      psychologistName: undefined,
    });
    console.log(
      `[stripe-webhook] welcome_paid | email=${email} | ran=${emailing.ran} | sent=${emailing.sent} | queued=${emailing.queued}`,
    );
  } catch (emailErr) {
    console.error('[stripe-webhook] welcome_paid failed', emailErr);
  }

  console.log(
    `[stripe-webhook] ${eventType} | email=${email} | outcome_updated=${result.outcome_updated} | onboarding_updated=${result.onboarding_updated} | conversation_created=${result.conversation_created}`,
  );
  return {
    outcome_updated: result.outcome_updated,
    onboarding_updated: result.onboarding_updated,
  };
}

export async function handleSubscriptionCancelled(
  supabase: SupabaseClient,
  stripe: Stripe,
  subscription: Stripe.Subscription,
): Promise<{ recovery_queued: boolean; churn_marked: number }> {
  const customerId = readCustomerId(subscription.customer);
  if (!customerId) return { recovery_queued: false, churn_marked: 0 };

  const email = await getStripeCustomerEmail(stripe, customerId);
  if (!email) return { recovery_queued: false, churn_marked: 0 };

  const canceledAt = subscription.canceled_at
    ? new Date(subscription.canceled_at * 1000).toISOString()
    : new Date().toISOString();
  const planExpiresAt = subscription.ended_at
    ? new Date(subscription.ended_at * 1000).toISOString()
    : subscription.cancel_at
      ? new Date(subscription.cancel_at * 1000).toISOString()
      : null;

  let churn_marked = 0;
  try {
    churn_marked = await markSubscriptionChurnedByEmail(supabase, email, {
      canceledAt,
      subscriptionId: subscription.id,
      planExpiresAt,
    });
  } catch (err) {
    console.error('[stripe-webhook] churn mark failed', err);
  }

  try {
    const { runRecoveryCancelledAutomation } = await import(
      '@/lib/emailing/automations'
    );
    const result = await runRecoveryCancelledAutomation({
      supabase,
      email,
    });
    console.log(
      `[stripe-webhook] recovery_cancelled | email=${email} | ran=${result.ran} | queued=${result.queued} | churn_marked=${churn_marked}`,
    );
    return {
      recovery_queued: result.ran && result.queued > 0,
      churn_marked,
    };
  } catch (err) {
    console.error('[stripe-webhook] recovery_cancelled failed', err);
    return { recovery_queued: false, churn_marked };
  }
}

/** Sync plan_expires_at / status on subscription.updated (non-cancel path). */
export async function handleSubscriptionUpdatedBillingSync(
  supabase: SupabaseClient,
  stripe: Stripe,
  subscription: Stripe.Subscription,
): Promise<{ billing_synced: number }> {
  const customerId = readCustomerId(subscription.customer);
  if (!customerId) return { billing_synced: 0 };

  const email = await getStripeCustomerEmail(stripe, customerId);
  if (!email) return { billing_synced: 0 };

  const planExpiresAt = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;

  if (subscription.status === 'canceled') {
    const churn_marked = await markSubscriptionChurnedByEmail(supabase, email, {
      subscriptionId: subscription.id,
      planExpiresAt,
    });
    return { billing_synced: churn_marked };
  }

  const billing_synced = await syncSubscriptionBillingMetadataByEmail(supabase, email, {
    subscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    planExpiresAt,
  });
  return { billing_synced };
}

export async function handleInvoicePaymentFailed(
  supabase: SupabaseClient,
  stripe: Stripe,
  invoice: Stripe.Invoice,
): Promise<{ alerted: boolean }> {
  const customerId = readCustomerId(invoice.customer);
  const email = customerId
    ? await getStripeCustomerEmail(stripe, customerId)
    : invoice.customer_email?.trim().toLowerCase() ?? null;

  const amount = ((invoice.amount_due ?? 0) / 100).toFixed(2);
  const attempt = invoice.attempt_count ?? 0;
  const text =
    `⚠️ <b>Stripe payment_failed</b>\n` +
    `Email: ${email ?? '?'}\n` +
    `Monto: $${amount}\n` +
    `Intentos: ${attempt}\n` +
    `Invoice: ${invoice.id}`;

  if (email) {
    await syncSubscriptionBillingMetadataByEmail(supabase, email, {
      subscriptionStatus: 'past_due',
      subscriptionId:
        typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription?.id ?? null,
    });
  }

  const result = await sendTelegramAlert(text);
  console.log(
    `[stripe-webhook] invoice.payment_failed | email=${email ?? '?'} | alerted=${result.sent}`,
  );
  return { alerted: result.sent };
}

export async function handleInvoicePaymentSucceeded(
  supabase: SupabaseClient,
  stripe: Stripe,
  invoice: Stripe.Invoice,
): Promise<{ outcome_updated: number; onboarding_updated: number }> {
  if (invoice.status !== 'paid' || (invoice.amount_paid ?? 0) <= 0) {
    return { outcome_updated: 0, onboarding_updated: 0 };
  }

  const billingReason = invoice.billing_reason ?? '';
  if (billingReason && !SUBSCRIPTION_INVOICE_REASONS.has(billingReason)) {
    console.log(
      `[stripe-webhook] skip invoice.payment_succeeded | reason=billing_${billingReason || 'unknown'}`,
    );
    return { outcome_updated: 0, onboarding_updated: 0 };
  }

  const customerId = readCustomerId(invoice.customer);
  if (!customerId) return { outcome_updated: 0, onboarding_updated: 0 };

  const email = await getStripeCustomerEmail(stripe, customerId);
  if (!email) return { outcome_updated: 0, onboarding_updated: 0 };

  const subscriptionId =
    typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription?.id ?? null;

  const result = await processCustomerPaid(supabase, email, 'stripe_webhook', {
    subscriptionId,
  });
  console.log(
    `[stripe-webhook] invoice.payment_succeeded | email=${email} | outcome_updated=${result.outcome_updated} | onboarding_updated=${result.onboarding_updated} | conversation_created=${result.conversation_created}`,
  );
  return {
    outcome_updated: result.outcome_updated,
    onboarding_updated: result.onboarding_updated,
  };
}

export async function handleCheckoutSessionCompleted(
  supabase: SupabaseClient,
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<{ outcome_updated: number; onboarding_updated: number }> {
  if (session.mode !== 'subscription') {
    return { outcome_updated: 0, onboarding_updated: 0 };
  }

  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id ?? null;

  if (!subscriptionId) {
    return { outcome_updated: 0, onboarding_updated: 0 };
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  return handleActiveSubscriptionPaid(supabase, stripe, subscription, 'checkout.session.completed');
}
