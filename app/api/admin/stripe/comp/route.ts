import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { compSubscriptionByEmail, getStripeClient } from '@/lib/stripe-comp-actions';
import { getKalyoClient } from '@/lib/kalyo-supabase';

export const dynamic = 'force-dynamic';

type CompBody = {
  email?: string;
  reason?: string;
  by?: string;
  subscription_id?: string;
  sync_kalyo?: boolean;
};

export async function POST(request: Request) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: CompBody = {};
  try {
    body = (await request.json()) as CompBody;
  } catch {
    body = {};
  }

  const email = body.email?.trim();
  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }

  const stripe = getStripeClient();
  if (!stripe) {
    return NextResponse.json({ error: 'STRIPE_SECRET_KEY not configured' }, { status: 500 });
  }

  const result = await compSubscriptionByEmail(stripe, {
    email,
    reason: body.reason?.trim() || 'cortesía',
    by: body.by?.trim() || 'admin',
    subscriptionId: body.subscription_id?.trim(),
  });

  let kalyo: { updated: boolean; error?: string } | null = null;
  if (result.ok && body.sync_kalyo !== false) {
    try {
      const client = getKalyoClient();
      const { error } = await client
        .from('psychologists')
        .update({
          subscription_status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('email', email.toLowerCase());
      kalyo = error ? { updated: false, error: error.message } : { updated: true };
    } catch (err) {
      kalyo = {
        updated: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return NextResponse.json({
    result,
    kalyo,
    appliedAt: new Date().toISOString(),
  });
}
