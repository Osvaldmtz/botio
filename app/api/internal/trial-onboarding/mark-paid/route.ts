import 'server-only';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { markPaidByEmail } from '@/lib/conversation-outcome';
import { markTrialUpgradedToPaid } from '@/lib/trial-onboarding-enrollment';

export const dynamic = 'force-dynamic';

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let email = '';
  try {
    const body = (await request.json()) as { email?: string };
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'email required' }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const updated = await markTrialUpgradedToPaid(supabase, email);
    const outcomeUpdated = await markPaidByEmail(supabase, email, 'stripe_webhook');
    return NextResponse.json({ status: 'ok', email, updated, outcome_updated: outcomeUpdated });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
