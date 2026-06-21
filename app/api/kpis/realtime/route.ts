import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { getGA4RealtimeUsers } from '@/lib/ga4-api';

export const dynamic = 'force-dynamic';

const LANDING_PROPERTY_ID = process.env.GA4_LANDING_PROPERTY_ID ?? '531207061';
const APP_PROPERTY_ID = process.env.GA4_APP_PROPERTY_ID ?? '539858946';

export async function GET() {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [landing, app] = await Promise.all([
      getGA4RealtimeUsers(LANDING_PROPERTY_ID),
      getGA4RealtimeUsers(APP_PROPERTY_ID),
    ]);

    return NextResponse.json({
      landing,
      app,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[api/kpis/realtime] failed', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
