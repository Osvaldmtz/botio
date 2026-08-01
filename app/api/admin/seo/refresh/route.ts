import 'server-only';

import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: 'Missing CRON_SECRET' }, { status: 500 });
  }

  try {
    const res = await fetch('https://team.kalyo.io/api/cron/seo-sync', {
      method: 'GET',
      headers: { Authorization: `Bearer ${secret}` },
      cache: 'no-store',
    });

    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const message =
        typeof body.error === 'string' ? body.error : `Cron seo-sync failed (${res.status})`;
      console.error('[admin/seo/refresh] cron failed', message);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[admin/seo/refresh] failed', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
