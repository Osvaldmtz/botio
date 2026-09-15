import 'server-only';
import { NextResponse } from 'next/server';
import {
  createDemoBookingCalendarEvent,
  type DemoBookingCalendarInput,
} from '@/lib/demo-booking-calendar';

export const dynamic = 'force-dynamic';

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET ?? process.env.BOTIO_WEBHOOK_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

function parseBody(body: unknown): DemoBookingCalendarInput | { error: string } {
  if (typeof body !== 'object' || body === null) {
    return { error: 'Invalid JSON body' };
  }

  const row = body as Record<string, unknown>;
  const bookingId = typeof row.booking_id === 'string' ? row.booking_id.trim() : '';
  const name = typeof row.name === 'string' ? row.name.trim() : '';
  const email = typeof row.email === 'string' ? row.email.trim().toLowerCase() : '';
  const whatsapp = typeof row.whatsapp === 'string' ? row.whatsapp.trim() : '';
  const scheduledAt = typeof row.scheduled_at === 'string' ? row.scheduled_at.trim() : '';

  if (!bookingId) return { error: 'booking_id required' };
  if (!name) return { error: 'name required' };
  if (!email) return { error: 'email required' };
  if (!whatsapp) return { error: 'whatsapp required' };
  if (!scheduledAt) return { error: 'scheduled_at required' };

  return {
    bookingId,
    name,
    email,
    whatsapp,
    scheduledAt,
    country: typeof row.country === 'string' ? row.country.trim() : null,
    interest: typeof row.interest === 'string' ? row.interest.trim() : null,
  };
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = parseBody(body);
  if ('error' in parsed) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  try {
    const result = await createDemoBookingCalendarEvent(parsed);
    if (!result.ok) {
      return NextResponse.json(result, { status: 500 });
    }
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[internal/demo-booking/calendar] failed', error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
