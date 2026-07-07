import 'server-only';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { processCustomerPaid } from '@/lib/conversation-outcome';

export const dynamic = 'force-dynamic';

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET ?? process.env.BOTIO_WEBHOOK_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let email = '';
  let name: string | undefined;
  try {
    const body = (await request.json()) as { email?: string; name?: string };
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    name = typeof body.name === 'string' ? body.name.trim() : undefined;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'email required' }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const result = await processCustomerPaid(supabase, email, 'kalyo_upgrade', { name });
    return NextResponse.json({ status: 'ok', email, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
