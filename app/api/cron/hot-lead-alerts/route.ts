import 'server-only';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { processHotLeadAlertQueue } from '@/lib/hot-lead-alert-cron';

export const dynamic = 'force-dynamic';

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const result = await processHotLeadAlertQueue(supabase);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[cron/hot-lead-alerts] failed', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
