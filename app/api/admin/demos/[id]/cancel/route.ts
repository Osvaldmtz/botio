import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { cancelDemoEvent } from '@/lib/google-calendar';

export const dynamic = 'force-dynamic';

type RouteContext = { params: { id: string } };

export async function POST(request: Request, context: RouteContext) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const demoId = context.params.id;
  let reason = 'Cancelled from admin dashboard';
  try {
    const body = (await request.json()) as { reason?: string };
    if (body.reason?.trim()) reason = body.reason.trim();
  } catch {
    // optional body
  }

  try {
    await cancelDemoEvent(demoId, reason);
    return NextResponse.json({ status: 'cancelled', demoId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[admin/demos/cancel] failed', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
