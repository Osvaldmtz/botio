export type CompMetadataInput = {
  reason: string;
  by: string;
  at?: string;
};

export type CompMetadata = {
  comp: 'true';
  comp_reason: string;
  compd_by: string;
  compd_at: string;
};

export type SubscriptionLike = {
  id?: string;
  status?: string | null;
  metadata?: Record<string, string> | null;
};

export function isCompedSubscription(sub: SubscriptionLike): boolean {
  return sub.metadata?.comp === 'true';
}

export function filterActionablePastDue<T extends SubscriptionLike>(subs: T[]): T[] {
  return subs.filter((sub) => !isCompedSubscription(sub));
}

export function buildCompMetadata(input: CompMetadataInput): CompMetadata {
  return {
    comp: 'true',
    comp_reason: input.reason,
    compd_by: input.by,
    compd_at: input.at ?? new Date().toISOString(),
  };
}

export type SubscriberCountSummary = {
  /** Active paying + active/past_due comps (excludes real past_due). */
  active_total: number;
  active_paying: number;
  active_comped: number;
  past_due_actionable: number;
};

export function summarizeSubscriberCounts(subs: SubscriptionLike[]): SubscriberCountSummary {
  let active_paying = 0;
  let active_comped = 0;
  let past_due_actionable = 0;

  for (const sub of subs) {
    const status = sub.status ?? '';
    const comped = isCompedSubscription(sub);

    if (status === 'active') {
      if (comped) active_comped += 1;
      else active_paying += 1;
      continue;
    }

    if (status === 'past_due') {
      if (comped) active_comped += 1;
      else past_due_actionable += 1;
    }
  }

  return {
    active_total: active_paying + active_comped,
    active_paying,
    active_comped,
    past_due_actionable,
  };
}
