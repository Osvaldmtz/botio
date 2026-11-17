/**
 * Stripe billing metrics for Botio KPIs / sync.
 * Thin facade over {@link ./stripe-mrr} with churn window helpers.
 */
import 'server-only';
import Stripe from 'stripe';
import { isCompedSubscription, summarizeSubscriberCounts } from '@/lib/stripe-comp';
import {
  fetchStripeActiveSubscriberCount,
  getMRRCached,
  type ChurnedSubscriptionDetail,
  type MRRMetrics,
} from '@/lib/stripe-mrr';
import { isTeamMember } from '@/lib/team-members';

export type { ChurnedSubscriptionDetail, MRRMetrics };

export type CanceledLast30dResult = {
  available: boolean;
  count: number;
  mrr_lost_usd: number;
  details: ChurnedSubscriptionDetail[];
  error?: string;
};

export type ChurnRateResult = {
  available: boolean;
  /** Monthly churn rate % = canceled_30d / active_start * 100 */
  churn_rate_pct: number;
  canceled_30d: number;
  active_subscribers: number;
  error?: string;
};

export type PastDueSnapshot = {
  available: boolean;
  past_due_total: number;
  past_due_actionable: number;
  past_due_comped: number;
  error?: string;
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

function customerIdFrom(sub: Stripe.Subscription): string {
  const customer = sub.customer;
  return typeof customer === 'string' ? customer : (customer?.id ?? '');
}

async function subscriptionEverPaid(stripe: Stripe, subscriptionId: string): Promise<boolean> {
  const invoices = await stripe.invoices.list({ subscription: subscriptionId, limit: 10 });
  return invoices.data.some((inv) => inv.status === 'paid' && (inv.amount_paid ?? 0) > 0);
}

function getStripeOrNull(): Stripe | null {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) return null;
  return new Stripe(secret, { apiVersion: '2025-02-24.acacia' });
}

/** Active (+ past_due comps counted as active) subscriber list summary. */
export async function getActiveSubscriptions(): Promise<{
  available: boolean;
  count: number;
  paying: number;
  comped: number;
  error?: string;
}> {
  const result = await fetchStripeActiveSubscriberCount();
  if (result.error || result.count == null) {
    return {
      available: false,
      count: 0,
      paying: 0,
      comped: 0,
      error: result.error ?? 'unavailable',
    };
  }
  return {
    available: true,
    count: result.count,
    paying: result.paying ?? 0,
    comped: result.comped ?? 0,
  };
}

/** Real MRR from Stripe (cached 5m). */
export async function getMRRReal(): Promise<MRRMetrics> {
  return getMRRCached();
}

/**
 * Paid subscriptions canceled in the last 30 days (excludes team, trial-only, resubscribed).
 */
export async function getCanceledLast30d(): Promise<CanceledLast30dResult> {
  const stripe = getStripeOrNull();
  if (!stripe) {
    return {
      available: false,
      count: 0,
      mrr_lost_usd: 0,
      details: [],
      error: 'STRIPE_SECRET_KEY not configured',
    };
  }

  try {
    const since = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
    const activeCustomerIds = new Set<string>();
    let startingAfter: string | undefined;

    // Paginate actives for customer-id set (resubscribe filter)
    for (;;) {
      const activePage: Stripe.ApiList<Stripe.Subscription> =
        await stripe.subscriptions.list({
          status: 'active',
          limit: 100,
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        });
      for (const sub of activePage.data) activeCustomerIds.add(customerIdFrom(sub));
      if (!activePage.has_more || activePage.data.length === 0) break;
      startingAfter = activePage.data[activePage.data.length - 1]?.id;
    }

    startingAfter = undefined;
    for (;;) {
      const pastDuePage: Stripe.ApiList<Stripe.Subscription> =
        await stripe.subscriptions.list({
          status: 'past_due',
          limit: 100,
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        });
      for (const sub of pastDuePage.data) {
        if (isCompedSubscription(sub)) activeCustomerIds.add(customerIdFrom(sub));
      }
      if (!pastDuePage.has_more || pastDuePage.data.length === 0) break;
      startingAfter = pastDuePage.data[pastDuePage.data.length - 1]?.id;
    }

    const details: ChurnedSubscriptionDetail[] = [];
    let count = 0;
    let mrrLost = 0;
    startingAfter = undefined;

    for (;;) {
      const canceledPage: Stripe.ApiList<Stripe.Subscription> =
        await stripe.subscriptions.list({
          status: 'canceled',
          limit: 100,
          expand: ['data.customer', 'data.items.data.price'],
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        });

      for (const sub of canceledPage.data) {
        const canceledAt = sub.canceled_at ?? sub.ended_at ?? 0;
        if (canceledAt < since) continue;

        let subMrr = 0;
        let planLabel: string | null = null;
        for (const item of sub.items.data) {
          const price = item.price;
          if (price && typeof price !== 'string') {
            subMrr += monthlyUsdFromPrice(price, item.quantity ?? 1);
            planLabel = price.nickname ?? price.id;
          }
        }

        const customer = sub.customer;
        const email =
          customer && typeof customer !== 'string' && !customer.deleted
            ? (customer.email ?? null)
            : null;
        const name =
          customer && typeof customer !== 'string' && !customer.deleted
            ? (customer.name ?? null)
            : null;
        const customerId = customerIdFrom(sub);

        const detail: ChurnedSubscriptionDetail = {
          subscription_id: sub.id,
          customer_id: customerId,
          email,
          name,
          plan_label: planLabel,
          mrr_usd: Math.round(subMrr * 100) / 100,
          canceled_at: new Date(canceledAt * 1000).toISOString(),
        };

        if (isTeamMember(email)) {
          details.push({ ...detail, excluded_reason: 'team_member' });
          continue;
        }
        if (activeCustomerIds.has(customerId)) {
          details.push({ ...detail, excluded_reason: 'resubscribed' });
          continue;
        }
        const everPaid = await subscriptionEverPaid(stripe, sub.id);
        if (!everPaid) {
          details.push({ ...detail, excluded_reason: 'trial_only' });
          continue;
        }

        details.push(detail);
        count += 1;
        mrrLost += subMrr;
      }

      if (!canceledPage.has_more || canceledPage.data.length === 0) break;
      startingAfter = canceledPage.data[canceledPage.data.length - 1]?.id;
    }

    details.sort((a, b) => a.canceled_at.localeCompare(b.canceled_at));

    return {
      available: true,
      count,
      mrr_lost_usd: Math.round(mrrLost * 100) / 100,
      details,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[stripe-metrics] getCanceledLast30d failed', error);
    return {
      available: false,
      count: 0,
      mrr_lost_usd: 0,
      details: [],
      error: message,
    };
  }
}

/** Churn rate over last 30 days vs current active base. */
export async function getChurnRate(): Promise<ChurnRateResult> {
  const [active, canceled] = await Promise.all([
    getActiveSubscriptions(),
    getCanceledLast30d(),
  ]);

  if (!active.available || !canceled.available) {
    return {
      available: false,
      churn_rate_pct: 0,
      canceled_30d: canceled.count,
      active_subscribers: active.count,
      error: active.error ?? canceled.error ?? 'unavailable',
    };
  }

  const startApprox = active.count + canceled.count;
  const churn_rate_pct =
    startApprox > 0
      ? Number(((canceled.count / startApprox) * 100).toFixed(2))
      : 0;

  return {
    available: true,
    churn_rate_pct,
    canceled_30d: canceled.count,
    active_subscribers: active.count,
  };
}

export async function getPastDueSnapshot(): Promise<PastDueSnapshot> {
  const stripe = getStripeOrNull();
  if (!stripe) {
    return {
      available: false,
      past_due_total: 0,
      past_due_actionable: 0,
      past_due_comped: 0,
      error: 'STRIPE_SECRET_KEY not configured',
    };
  }

  try {
    const all: Stripe.Subscription[] = [];
    let startingAfter: string | undefined;
    for (;;) {
      const page = await stripe.subscriptions.list({
        status: 'past_due',
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      all.push(...page.data);
      if (!page.has_more || page.data.length === 0) break;
      startingAfter = page.data[page.data.length - 1]?.id;
    }
    const counts = summarizeSubscriberCounts(all);
    return {
      available: true,
      past_due_total: all.length,
      past_due_actionable: counts.past_due_actionable,
      past_due_comped: all.length - counts.past_due_actionable,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      available: false,
      past_due_total: 0,
      past_due_actionable: 0,
      past_due_comped: 0,
      error: message,
    };
  }
}

/** Bundle used by kalyo-sync daily snapshot. */
export async function getStripeMetricsSnapshot(): Promise<{
  available: boolean;
  stripe_mrr: number;
  stripe_active: number;
  stripe_churned_30d: number;
  stripe_churn_rate: number;
  stripe_mrr_lost_30d: number;
  past_due_actionable: number;
  error?: string;
}> {
  const [mrr, canceled, pastDue] = await Promise.all([
    getMRRReal(),
    getCanceledLast30d(),
    getPastDueSnapshot(),
  ]);

  if (!mrr.available) {
    return {
      available: false,
      stripe_mrr: 0,
      stripe_active: 0,
      stripe_churned_30d: 0,
      stripe_churn_rate: 0,
      stripe_mrr_lost_30d: 0,
      past_due_actionable: 0,
      error: mrr.error,
    };
  }

  const startApprox = mrr.active_subscriptions + canceled.count;
  const stripe_churn_rate =
    startApprox > 0
      ? Number(((canceled.count / startApprox) * 100).toFixed(2))
      : 0;

  return {
    available: true,
    stripe_mrr: mrr.current_mrr_usd,
    stripe_active: mrr.active_subscriptions,
    stripe_churned_30d: canceled.count,
    stripe_churn_rate,
    stripe_mrr_lost_30d: canceled.mrr_lost_usd,
    past_due_actionable: pastDue.past_due_actionable,
  };
}
