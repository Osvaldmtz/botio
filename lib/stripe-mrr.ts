import Stripe from 'stripe';

export type ChurnedSubscriptionDetail = {
  subscription_id: string;
  customer_id: string;
  email: string | null;
  name: string | null;
  plan_label: string | null;
  mrr_usd: number;
  canceled_at: string;
};

export type MRRMetrics = {
  available: boolean;
  current_mrr_usd: number;
  active_subscriptions: number;
  new_subs_this_month: number;
  churned_this_month: number;
  churned_details?: ChurnedSubscriptionDetail[];
  net_growth_mrr_usd: number;
  mrr_growth_pct: number | null;
  error?: string;
};

let cachedMRR: MRRMetrics | null = null;
let cacheTime = 0;
const CACHE_MS = 5 * 60 * 1000;

function monthlyUsdFromPrice(price: Stripe.Price, quantity: number): number {
  const unit = (price.unit_amount ?? 0) / 100;
  const qty = quantity || 1;
  const interval = price.recurring?.interval;
  if (interval === 'year') return (unit / 12) * qty;
  if (interval === 'week') return unit * 4.33 * qty;
  if (interval === 'day') return unit * 30 * qty;
  return unit * qty;
}

async function listAllActiveSubscriptions(stripe: Stripe): Promise<Stripe.Subscription[]> {
  const all: Stripe.Subscription[] = [];
  let startingAfter: string | undefined;
  for (;;) {
    const page = await stripe.subscriptions.list({
      status: 'active',
      limit: 100,
      expand: ['data.items.data.price'],
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    all.push(...page.data);
    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data[page.data.length - 1]?.id;
  }
  return all;
}

async function getMRR(): Promise<MRRMetrics> {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) {
    return {
      available: false,
      current_mrr_usd: 0,
      active_subscriptions: 0,
      new_subs_this_month: 0,
      churned_this_month: 0,
      net_growth_mrr_usd: 0,
      mrr_growth_pct: null,
      error: 'STRIPE_SECRET_KEY not configured',
    };
  }

  try {
    const stripe = new Stripe(secret, { apiVersion: '2025-02-24.acacia' });
    const subs = await listAllActiveSubscriptions(stripe);

    let mrr = 0;
    for (const sub of subs) {
      for (const item of sub.items.data) {
        const price = item.price;
        if (price && typeof price !== 'string') {
          mrr += monthlyUsdFromPrice(price, item.quantity ?? 1);
        }
      }
    }

    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    firstDayOfMonth.setHours(0, 0, 0, 0);
    const monthStart = Math.floor(firstDayOfMonth.getTime() / 1000);

    const newSubs = subs.filter((s) => s.created >= monthStart);

    let churnedThisMonth = 0;
    let churnedMrr = 0;
    const churnedDetails: ChurnedSubscriptionDetail[] = [];
    let canceledStartingAfter: string | undefined;
    for (;;) {
      const canceledPage = await stripe.subscriptions.list({
        status: 'canceled',
        limit: 100,
        expand: ['data.customer', 'data.items.data.price'],
        ...(canceledStartingAfter ? { starting_after: canceledStartingAfter } : {}),
      });
      for (const sub of canceledPage.data) {
        const canceledAt = sub.canceled_at ?? sub.ended_at ?? 0;
        if (canceledAt >= monthStart) {
          churnedThisMonth += 1;
          let subMrr = 0;
          let planLabel: string | null = null;
          for (const item of sub.items.data) {
            const price = item.price;
            if (price && typeof price !== 'string') {
              subMrr += monthlyUsdFromPrice(price, item.quantity ?? 1);
              planLabel = price.nickname ?? price.id;
            }
          }
          churnedMrr += subMrr;
          const customer = sub.customer;
          churnedDetails.push({
            subscription_id: sub.id,
            customer_id: typeof customer === 'string' ? customer : (customer?.id ?? ''),
            email:
              customer && typeof customer !== 'string' && !customer.deleted
                ? customer.email
                : null,
            name:
              customer && typeof customer !== 'string' && !customer.deleted
                ? customer.name
                : null,
            plan_label: planLabel,
            mrr_usd: Math.round(subMrr * 100) / 100,
            canceled_at: new Date(canceledAt * 1000).toISOString(),
          });
        }
      }
      if (!canceledPage.has_more || canceledPage.data.length === 0) break;
      canceledStartingAfter = canceledPage.data[canceledPage.data.length - 1]?.id;
    }

    churnedDetails.sort((a, b) => a.canceled_at.localeCompare(b.canceled_at));

    const newMrr = newSubs.reduce((sum, sub) => {
      let subMrr = 0;
      for (const item of sub.items.data) {
        const price = item.price;
        if (price && typeof price !== 'string') {
          subMrr += monthlyUsdFromPrice(price, item.quantity ?? 1);
        }
      }
      return sum + subMrr;
    }, 0);

    const netGrowth = Math.round((newMrr - churnedMrr) * 100) / 100;
    const prevMrr = mrr - netGrowth;
    const growthPct =
      prevMrr > 0 ? Math.round((netGrowth / prevMrr) * 1000) / 10 : null;

    return {
      available: true,
      current_mrr_usd: Math.round(mrr * 100) / 100,
      active_subscriptions: subs.length,
      new_subs_this_month: newSubs.length,
      churned_this_month: churnedThisMonth,
      churned_details: churnedDetails,
      net_growth_mrr_usd: netGrowth,
      mrr_growth_pct: growthPct,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[stripe-mrr] failed', error);
    return {
      available: false,
      current_mrr_usd: 0,
      active_subscriptions: 0,
      new_subs_this_month: 0,
      churned_this_month: 0,
      net_growth_mrr_usd: 0,
      mrr_growth_pct: null,
      error: message,
    };
  }
}

export async function getMRRCached(): Promise<MRRMetrics> {
  if (Date.now() - cacheTime < CACHE_MS && cachedMRR) return cachedMRR;
  cachedMRR = await getMRR();
  cacheTime = Date.now();
  return cachedMRR;
}

/** Active Stripe subscriptions (`status: active`) — no cache, for live dashboard reads. */
export async function fetchStripeActiveSubscriberCount(): Promise<{
  count: number | null;
  error: string | null;
}> {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) {
    return { count: null, error: 'STRIPE_SECRET_KEY not configured' };
  }

  try {
    const stripe = new Stripe(secret, { apiVersion: '2025-02-24.acacia' });
    const subs = await listAllActiveSubscriptions(stripe);
    return { count: subs.length, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[stripe-mrr] active subscriber count failed', error);
    return { count: null, error: message };
  }
}
