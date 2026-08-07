import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  listAutomations,
  setAutomationActive,
} from '@/lib/emailing/automations';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const automations = await listAutomations(supabase);
    return NextResponse.json({ automations });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { id?: string; active?: boolean };
    if (!body.id || typeof body.active !== 'boolean') {
      return NextResponse.json(
        { error: 'id and active are required' },
        { status: 400 },
      );
    }
    const supabase = createAdminClient();
    const automation = await setAutomationActive(
      supabase,
      body.id,
      body.active,
    );
    return NextResponse.json({ automation });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
