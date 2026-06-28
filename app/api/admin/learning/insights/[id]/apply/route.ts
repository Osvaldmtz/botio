import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { markLearningInsightApplied } from '@/lib/learning-queries';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

export async function POST(_request: Request, { params }: Params) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const insight = await markLearningInsightApplied(supabase, params.id);

    if (!insight) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    console.log(`[learning] insight applied | id=${params.id}`);
    return NextResponse.json({ ok: true, insight });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
