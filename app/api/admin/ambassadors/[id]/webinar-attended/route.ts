import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { markAmbassadorWebinarAttended } from '@/lib/ambassador-admin-queries';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { attended?: boolean };
  try {
    body = (await request.json()) as { attended?: boolean };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const attended = body.attended !== false;

  try {
    const supabase = createAdminClient();
    await markAmbassadorWebinarAttended(supabase, params.id, attended);
    return NextResponse.json({ success: true, attended });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[admin/ambassadors/webinar-attended] failed', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
