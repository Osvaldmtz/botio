import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const filter = searchParams.get('filter') ?? 'upcoming';

  const supabase = createAdminClient();
  let query = supabase
    .from('scheduled_demos')
    .select('*')
    .order('scheduled_at', { ascending: filter !== 'past' });

  const now = new Date().toISOString();

  if (filter === 'upcoming') {
    query = query.eq('status', 'scheduled').gte('scheduled_at', now);
  } else if (filter === 'past') {
    query = query.lt('scheduled_at', now).neq('status', 'cancelled');
  } else if (filter === 'cancelled') {
    query = query.eq('status', 'cancelled');
  }

  const { data, error } = await query.limit(200);

  if (error) {
    console.error('[admin/demos] GET failed', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ demos: data ?? [], filter, fetchedAt: now });
}
