import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import {
  getStripeCustomerHistory,
  investigateStripeKalyo,
  listActiveStripeSubscriptions,
  reconcileStripeKalyo,
} from '@/lib/stripe-kalyo-reconcile';

export const dynamic = 'force-dynamic';

function parseEmails(request: Request): string[] {
  const url = new URL(request.url);
  const queryEmails = url.searchParams.get('emails');
  if (queryEmails) {
    return queryEmails.split(',').map((e) => e.trim()).filter(Boolean);
  }
  return [];
}

export async function GET(request: Request) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const emails = parseEmails(request);
  const url = new URL(request.url);
  const customerId = url.searchParams.get('customer_id');

  if (customerId) {
    const history = await getStripeCustomerHistory(customerId.trim());
    return NextResponse.json({ history, fetchedAt: new Date().toISOString() });
  }

  if (emails.length === 0) {
    const scan = url.searchParams.get('scan');
    if (scan === 'active') {
      const active = await listActiveStripeSubscriptions();
      return NextResponse.json({ active, fetchedAt: new Date().toISOString() });
    }
    return NextResponse.json(
      { error: 'Provide ?emails=one@mail.com or ?scan=active' },
      { status: 400 },
    );
  }

  const results = await investigateStripeKalyo(emails);
  return NextResponse.json({ results, fetchedAt: new Date().toISOString() });
}

export async function POST(request: Request) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let emails = parseEmails(request);
  if (emails.length === 0) {
    try {
      const body = (await request.json()) as { emails?: string[] };
      emails = (body.emails ?? []).map((e) => e.trim()).filter(Boolean);
    } catch {
      emails = [];
    }
  }

  if (emails.length === 0) {
    return NextResponse.json(
      { error: 'Provide emails via ?emails= or JSON body { emails: [] }' },
      { status: 400 },
    );
  }

  const results = await reconcileStripeKalyo(emails);
  return NextResponse.json({ results, syncedAt: new Date().toISOString() });
}
