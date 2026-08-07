import 'server-only';
import { getKalyoClient } from '@/lib/kalyo-supabase';

export const EMAIL_SEGMENTS = [
  {
    id: 'trial_activo',
    label: 'Trial activo',
    description: 'Psicólogos en prueba de 7 días',
  },
  {
    id: 'plan_pro',
    label: 'Plan Pro',
    description: 'Suscriptores Pro activos (plan starter)',
  },
  {
    id: 'plan_max',
    label: 'Plan Max',
    description: 'Suscriptores Max activos (professional/clinic)',
  },
  {
    id: 'trial_vencido_no_pago',
    label: 'Trial vencido sin pago',
    description: 'Trial vencido sin conversión a plan de pago',
  },
  {
    id: 'cancelado',
    label: 'Cancelado',
    description: 'Suscripción cancelada o inactiva',
  },
] as const;

export type EmailSegmentId = (typeof EMAIL_SEGMENTS)[number]['id'];

export type SegmentContact = {
  email: string;
  name: string | null;
  plan: string | null;
  subscriptionStatus: string | null;
};

type PsychRow = {
  email: string | null;
  full_name: string | null;
  plan: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
};

const EXCLUDED_TRIAL_STATUSES = new Set(['active', 'canceled', 'inactive']);

function isActiveTrial(row: PsychRow): boolean {
  const status = row.subscription_status ?? '';
  if (EXCLUDED_TRIAL_STATUSES.has(status)) return false;
  if (!row.trial_ends_at) return false;
  return new Date(row.trial_ends_at).getTime() > Date.now();
}

function isPaidActive(row: PsychRow): boolean {
  return (row.subscription_status ?? '') === 'active' && !isActiveTrial(row);
}

function matchesSegment(row: PsychRow, segment: EmailSegmentId): boolean {
  const status = row.subscription_status ?? '';
  const plan = row.plan ?? '';

  switch (segment) {
    case 'trial_activo':
      return isActiveTrial(row);
    case 'plan_pro':
      return isPaidActive(row) && plan === 'starter';
    case 'plan_max':
      return (
        isPaidActive(row) && (plan === 'professional' || plan === 'clinic')
      );
    case 'trial_vencido_no_pago': {
      if (status === 'active') return false;
      if (status === 'canceled' || status === 'inactive') return false;
      if (!row.trial_ends_at) return false;
      return new Date(row.trial_ends_at).getTime() <= Date.now();
    }
    case 'cancelado':
      return status === 'canceled' || status === 'inactive';
    default:
      return false;
  }
}

async function loadPsychologists(): Promise<PsychRow[]> {
  const kalyo = getKalyoClient();
  const { data, error } = await kalyo
    .from('psychologists')
    .select('email, full_name, plan, subscription_status, trial_ends_at');
  if (error) throw error;
  return (data ?? []) as PsychRow[];
}

function contactsForSegment(
  rows: PsychRow[],
  segment: EmailSegmentId,
): SegmentContact[] {
  const out: SegmentContact[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (!matchesSegment(row, segment)) continue;
    const email = row.email?.trim().toLowerCase();
    if (!email || !email.includes('@') || seen.has(email)) continue;
    seen.add(email);
    out.push({
      email,
      name: row.full_name,
      plan: row.plan,
      subscriptionStatus: row.subscription_status,
    });
  }

  return out;
}

export async function listSegmentSummaries(): Promise<
  Array<(typeof EMAIL_SEGMENTS)[number] & { count: number }>
> {
  const rows = await loadPsychologists();
  return EMAIL_SEGMENTS.map((seg) => ({
    ...seg,
    count: contactsForSegment(rows, seg.id).length,
  }));
}

export async function fetchSegmentContacts(
  segment: EmailSegmentId,
): Promise<SegmentContact[]> {
  const rows = await loadPsychologists();
  return contactsForSegment(rows, segment);
}

export function isEmailSegmentId(value: string): value is EmailSegmentId {
  return EMAIL_SEGMENTS.some((s) => s.id === value);
}
