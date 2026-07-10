import 'server-only';
import Stripe from 'stripe';
import { getKalyoClient } from '@/lib/kalyo-supabase';

export type StripeSubscriptionSnapshot = {
  subscription_id: string;
  customer_id: string;
  email: string | null;
  status: string;
  plan: 'starter' | 'professional' | 'clinic' | 'free';
  mrr_usd: number;
  current_period_end: string | null;
  canceled_at: string | null;
  created_at: string;
};

export type KalyoPsychologistSnapshot = {
  id: string;
  email: string;
  full_name: string | null;
  plan: string | null;
  subscription_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_current_period_end: string | null;
  created_at: string;
};

export type ReconcileResult = {
  email: string;
  stripe: StripeSubscriptionSnapshot[];
  kalyo_accounts: KalyoPsychologistSnapshot[];
  action: 'synced' | 'already_ok' | 'no_active_stripe' | 'no_kalyo_account' | 'error';
  message: string;
  updated_psychologist_id?: string;
};

function monthlyUsdFromPrice(price: Stripe.Price, quantity: number): number {
  const unit = (price.unit_amount ?? 0) / 100;
  const qty = quantity || 1;
  const interval = price.recurring?.interval;
  if (interval === 'year') return (unit / 12) * qty;
  if (interval === 'week') return unit * 4.33 * qty;
  if (interval === 'day') return unit * 30 * qty;
  return unit * qty;
}

function planFromMrr(mrrUsd: number): 'starter' | 'professional' | 'clinic' | 'free' {
  if (mrrUsd >= 70) return 'clinic';
  if (mrrUsd >= 35) return 'professional';
  if (mrrUsd >= 20) return 'starter';
  return 'free';
}

function snapshotFromSubscription(
  sub: Stripe.Subscription,
  email: string | null,
): StripeSubscriptionSnapshot {
  let mrr = 0;
  for (const item of sub.items.data) {
    const price = item.price;
    if (price && typeof price !== 'string') {
      mrr += monthlyUsdFromPrice(price, item.quantity ?? 1);
    }
  }
  const customer = sub.customer;
  return {
    subscription_id: sub.id,
    customer_id: typeof customer === 'string' ? customer : (customer?.id ?? ''),
    email,
    status: sub.status,
    plan: planFromMrr(mrr),
    mrr_usd: Math.round(mrr * 100) / 100,
    current_period_end: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
    canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
    created_at: new Date(sub.created * 1000).toISOString(),
  };
}

async function listSubscriptionsForCustomer(
  stripe: Stripe,
  customerId: string,
  email: string | null,
): Promise<StripeSubscriptionSnapshot[]> {
  const page = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 100,
    expand: ['data.items.data.price'],
  });
  return page.data.map((sub) => snapshotFromSubscription(sub, email));
}

async function findStripeSubscriptionsByEmail(
  stripe: Stripe,
  email: string,
): Promise<StripeSubscriptionSnapshot[]> {
  const normalized = email.trim().toLowerCase();
  const customers = await stripe.customers.list({ email: normalized, limit: 100 });
  const snapshots: StripeSubscriptionSnapshot[] = [];

  for (const customer of customers.data) {
    const subs = await listSubscriptionsForCustomer(stripe, customer.id, customer.email);
    snapshots.push(...subs);
  }

  snapshots.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return snapshots;
}

function pickCanonicalKalyoAccount(
  accounts: KalyoPsychologistSnapshot[],
): KalyoPsychologistSnapshot | null {
  if (accounts.length === 0) return null;
  return [...accounts].sort((a, b) => {
    const aScore =
      (a.full_name && a.full_name.length > 8 ? 2 : 0) +
      (a.stripe_customer_id ? 1 : 0) +
      (a.stripe_subscription_id ? 2 : 0);
    const bScore =
      (b.full_name && b.full_name.length > 8 ? 2 : 0) +
      (b.stripe_customer_id ? 1 : 0) +
      (b.stripe_subscription_id ? 2 : 0);
    if (bScore !== aScore) return bScore - aScore;
    return a.created_at.localeCompare(b.created_at);
  })[0];
}

export async function listActiveStripeSubscriptions(): Promise<StripeSubscriptionSnapshot[]> {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) return [];

  const stripe = new Stripe(secret, { apiVersion: '2025-02-24.acacia' });
  const snapshots: StripeSubscriptionSnapshot[] = [];
  let startingAfter: string | undefined;

  for (;;) {
    const page = await stripe.subscriptions.list({
      status: 'active',
      limit: 100,
      expand: ['data.customer', 'data.items.data.price'],
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    for (const sub of page.data) {
      const customer = sub.customer;
      const email =
        customer && typeof customer !== 'string' && !customer.deleted
          ? (customer.email ?? null)
          : null;
      snapshots.push(snapshotFromSubscription(sub, email));
    }

    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data[page.data.length - 1]?.id;
  }

  return snapshots;
}

  emails: string[],
): Promise<ReconcileResult[]> {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) {
    return emails.map((email) => ({
      email,
      stripe: [],
      kalyo_accounts: [],
      action: 'error',
      message: 'STRIPE_SECRET_KEY not configured',
    }));
  }

  const stripe = new Stripe(secret, { apiVersion: '2025-02-24.acacia' });
  const kalyo = getKalyoClient();
  const results: ReconcileResult[] = [];

  for (const rawEmail of emails) {
    const email = rawEmail.trim().toLowerCase();
    const { data: kalyoAccounts, error } = await kalyo
      .from('psychologists')
      .select(
        'id, email, full_name, plan, subscription_status, stripe_customer_id, stripe_subscription_id, subscription_current_period_end, created_at',
      )
      .eq('email', email);

    if (error) {
      results.push({
        email,
        stripe: [],
        kalyo_accounts: [],
        action: 'error',
        message: error.message,
      });
      continue;
    }

    const stripeSubs = await findStripeSubscriptionsByEmail(stripe, email);
    const activeStripe = stripeSubs.filter((s) => s.status === 'active');

    results.push({
      email,
      stripe: stripeSubs,
      kalyo_accounts: (kalyoAccounts ?? []) as KalyoPsychologistSnapshot[],
      action:
        activeStripe.length > 0
          ? 'already_ok'
          : stripeSubs.length > 0
            ? 'no_active_stripe'
            : 'no_active_stripe',
      message:
        activeStripe.length > 0
          ? `${activeStripe.length} active Stripe subscription(s) found`
          : stripeSubs.length > 0
            ? 'Only canceled/inactive Stripe subscriptions found'
            : 'No Stripe subscriptions for this email',
    });
  }

  return results;
}

export async function reconcileStripeKalyo(emails: string[]): Promise<ReconcileResult[]> {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) {
    return emails.map((email) => ({
      email,
      stripe: [],
      kalyo_accounts: [],
      action: 'error',
      message: 'STRIPE_SECRET_KEY not configured',
    }));
  }

  const stripe = new Stripe(secret, { apiVersion: '2025-02-24.acacia' });
  const kalyo = getKalyoClient();
  const results: ReconcileResult[] = [];

  for (const rawEmail of emails) {
    const email = rawEmail.trim().toLowerCase();

    const { data: kalyoAccounts, error: findError } = await kalyo
      .from('psychologists')
      .select(
        'id, email, full_name, plan, subscription_status, stripe_customer_id, stripe_subscription_id, subscription_current_period_end, created_at',
      )
      .eq('email', email);

    if (findError) {
      results.push({
        email,
        stripe: [],
        kalyo_accounts: [],
        action: 'error',
        message: findError.message,
      });
      continue;
    }

    const accounts = (kalyoAccounts ?? []) as KalyoPsychologistSnapshot[];
    const canonical = pickCanonicalKalyoAccount(accounts);
    const stripeSubs = await findStripeSubscriptionsByEmail(stripe, email);
    const activeStripe = stripeSubs.find((s) => s.status === 'active');

    if (!canonical) {
      results.push({
        email,
        stripe: stripeSubs,
        kalyo_accounts: accounts,
        action: 'no_kalyo_account',
        message: 'No Kalyo psychologist account for this email',
      });
      continue;
    }

    if (!activeStripe) {
      results.push({
        email,
        stripe: stripeSubs,
        kalyo_accounts: accounts,
        action: 'no_active_stripe',
        message: 'No active Stripe subscription to sync',
      });
      continue;
    }

    const alreadyLinked =
      canonical.subscription_status === 'active' &&
      canonical.stripe_subscription_id === activeStripe.subscription_id &&
      canonical.plan === activeStripe.plan;

    if (alreadyLinked) {
      results.push({
        email,
        stripe: stripeSubs,
        kalyo_accounts: accounts,
        action: 'already_ok',
        message: 'Kalyo already linked to active Stripe subscription',
        updated_psychologist_id: canonical.id,
      });
      continue;
    }

    const { error: updateError } = await kalyo
      .from('psychologists')
      .update({
        plan: activeStripe.plan,
        stripe_customer_id: activeStripe.customer_id,
        stripe_subscription_id: activeStripe.subscription_id,
        subscription_status: 'active',
        subscription_current_period_end: activeStripe.current_period_end,
        plan_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', canonical.id);

    if (updateError) {
      results.push({
        email,
        stripe: stripeSubs,
        kalyo_accounts: accounts,
        action: 'error',
        message: updateError.message,
      });
      continue;
    }

    results.push({
      email,
      stripe: stripeSubs,
      kalyo_accounts: accounts,
      action: 'synced',
      message: `Synced ${canonical.email} → ${activeStripe.subscription_id} (${activeStripe.plan})`,
      updated_psychologist_id: canonical.id,
    });
  }

  return results;
}
