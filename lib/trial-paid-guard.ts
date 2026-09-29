/**
 * Trial WhatsApp follow-ups must not go out once Stripe shows an active
 * subscription. Kalyo stores that as psychologists.subscription_status = 'active'
 * together with stripe_customer_id / stripe_subscription_id.
 */

export type PaidSubscriptionFields = {
  subscription_status?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
};

export function hasActivePaidSubscription(row: PaidSubscriptionFields): boolean {
  return (row.subscription_status ?? '').trim().toLowerCase() === 'active';
}

export function filterTrialFollowupRecipients<T extends PaidSubscriptionFields>(users: T[]): T[] {
  return users.filter((user) => !hasActivePaidSubscription(user));
}

/** Lookup keys for the same WhatsApp across duplicate psychologist rows. */
export function phoneLookupVariants(raw: string | null | undefined): string[] {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) return [];

  const variants = new Set<string>();
  variants.add(trimmed);

  const withoutPrefix = trimmed.replace(/^whatsapp:/i, '');
  if (withoutPrefix) variants.add(withoutPrefix);

  const digits = withoutPrefix.replace(/\D/g, '');
  if (digits) {
    variants.add(digits);
    variants.add(`+${digits}`);
    variants.add(`whatsapp:+${digits}`);
  }

  return Array.from(variants);
}

type SubscriptionRow = PaidSubscriptionFields & {
  email?: string | null;
  phone?: string | null;
};

type PsychologistQuery = {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): PromiseLike<{ data: SubscriptionRow[] | null; error: { message: string } | null }>;
      in(column: string, values: string[]): PromiseLike<{ data: SubscriptionRow[] | null; error: { message: string } | null }>;
    };
  };
};

const SUBSCRIPTION_COLUMNS =
  'email, phone, subscription_status, stripe_customer_id, stripe_subscription_id';

async function loadMatchingPsychologists(
  kalyo: PsychologistQuery,
  params: { email?: string | null; phone?: string | null },
): Promise<SubscriptionRow[]> {
  const rows: SubscriptionRow[] = [];
  const email = params.email?.trim().toLowerCase();

  if (email && email.includes('@')) {
    const { data, error } = await kalyo
      .from('psychologists')
      .select(SUBSCRIPTION_COLUMNS)
      .eq('email', email);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
  }

  const phones = phoneLookupVariants(params.phone);
  if (phones.length > 0) {
    const { data, error } = await kalyo
      .from('psychologists')
      .select(SUBSCRIPTION_COLUMNS)
      .in('phone', phones);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
  }

  return rows;
}

/**
 * True when this email, or another Kalyo account on the same phone, has an
 * active Stripe subscription (subscription_status = 'active').
 * Returns false if Kalyo is unreachable. Callers that already loaded
 * subscription_status must filter that field before relying on this lookup.
 */
export async function contactHasActiveKalyoSubscription(params: {
  email?: string | null;
  phone?: string | null;
}): Promise<boolean> {
  try {
    const { getKalyoClient } = await import('@/lib/kalyo');
    const rows = await loadMatchingPsychologists(
      getKalyoClient() as unknown as PsychologistQuery,
      params,
    );
    return rows.some(hasActivePaidSubscription);
  } catch (err) {
    console.error('[trial-followup] kalyo subscription lookup failed', err);
    return false;
  }
}
