import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getLogPreview, listLogs } from '@/lib/emailing/queries';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const previewId = searchParams.get('previewId');
    const supabase = createAdminClient();

    if (previewId) {
      const preview = await getLogPreview(supabase, previewId);
      if (!preview) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      return NextResponse.json({ preview });
    }

    const page = Number(searchParams.get('page') ?? '1');
    const result = await listLogs(supabase, page);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
