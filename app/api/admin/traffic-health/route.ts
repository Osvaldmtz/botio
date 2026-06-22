import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatLastMessageLabel, getTrafficHealthStats } from '@/lib/traffic-health';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const stats = await getTrafficHealthStats(supabase);
    return NextResponse.json({
      ...stats,
      last_user_message_label: formatLastMessageLabel(stats),
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[admin/traffic-health] failed', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
