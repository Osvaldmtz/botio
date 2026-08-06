import { isAdmin } from '@/lib/admin-auth';
import { formatUnknownError } from '@/lib/format-error';
import { fetchTrialAcquisitionBreakdown } from '@/lib/trial-acquisition-queries';
import type { TrialAcquisitionDays } from '@/lib/trial-acquisition-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_DAYS = new Set<TrialAcquisitionDays>([7, 30, 90]);

function parseDays(value: string | null): TrialAcquisitionDays | null {
  if (!value) return 30;
  const n = Number(value);
  if (!Number.isInteger(n)) return null;
  return ALLOWED_DAYS.has(n as TrialAcquisitionDays) ? (n as TrialAcquisitionDays) : null;
}

export async function GET(request: Request) {
  if (!isAdmin()) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const days = parseDays(new URL(request.url).searchParams.get('days'));
  if (days == null) {
    return Response.json({ error: 'days must be 7, 30, or 90' }, { status: 400 });
  }

  try {
    const data = await fetchTrialAcquisitionBreakdown(days);
    return Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[admin/trial-acquisition]', error);
    return Response.json({ error: formatUnknownError(error) }, { status: 500 });
  }
}
