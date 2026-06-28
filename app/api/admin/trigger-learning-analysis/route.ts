import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { runLearningAnalysis } from '@/lib/learning-analysis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const result = await runLearningAnalysis(supabase);
    return NextResponse.json({ ...result, timestamp: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[trigger-learning-analysis] failed', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
