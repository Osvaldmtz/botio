import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { patchSequence } from '@/lib/emailing/queries';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      active?: boolean;
      delayDays?: number;
    };
    const supabase = createAdminClient();
    const sequence = await patchSequence(supabase, params.id, body);
    return NextResponse.json({ sequence });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes('No valid') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
