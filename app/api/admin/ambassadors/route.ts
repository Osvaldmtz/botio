import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  fetchAmbassadorMetrics,
  fetchAmbassadorRows,
  type AmbassadorFilter,
} from '@/lib/ambassador-admin-queries';

export const dynamic = 'force-dynamic';

function parseFilter(value: string | null): AmbassadorFilter {
  if (value === 'registered' || value === 'unregistered') return value;
  return 'all';
}

export async function GET(request: Request) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const filter = parseFilter(searchParams.get('filter'));
  const supabase = createAdminClient();

  try {
    const [rows, metrics] = await Promise.all([
      fetchAmbassadorRows(supabase, filter),
      fetchAmbassadorMetrics(supabase),
    ]);

    return NextResponse.json({
      rows,
      metrics,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[admin/ambassadors] fetch failed', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
