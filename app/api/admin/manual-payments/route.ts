import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  createManualPayment,
  listManualPayments,
  ManualPaymentNotFoundError,
  ManualPaymentValidationError,
  parseCreateManualPaymentBody,
} from '@/lib/manual-payments';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === '1';
    const supabase = createAdminClient();
    const payments = await listManualPayments(supabase, { activeOnly });
    return NextResponse.json({ payments });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const input = parseCreateManualPaymentBody(body);
    const supabase = createAdminClient();
    const result = await createManualPayment(supabase, input);
    return NextResponse.json({ status: 'ok', ...result }, { status: 201 });
  } catch (error) {
    if (error instanceof ManualPaymentValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof ManualPaymentNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error('[manual-payments] create failed', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
