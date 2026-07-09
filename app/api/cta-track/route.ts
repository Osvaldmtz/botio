import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  buildCtaEventInsert,
  ctaTrackCorsHeaders,
  parseCtaTrackPayload,
} from '@/lib/cta-track';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonResponse(body: unknown, status: number, origin: string | null) {
  return NextResponse.json(body, { status, headers: ctaTrackCorsHeaders(origin) });
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, { status: 204, headers: ctaTrackCorsHeaders(origin) });
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = parseCtaTrackPayload(body);

    if ('error' in parsed) {
      return jsonResponse({ error: parsed.error }, 400, origin);
    }

    const supabase = createAdminClient();
    const { error } = await supabase.from('cta_events').insert(buildCtaEventInsert(parsed));

    if (error) {
      console.error('[cta-track] insert failed', error);
      return jsonResponse({ error: 'Failed to store event' }, 500, origin);
    }

    return jsonResponse({ ok: true }, 201, origin);
  } catch (err) {
    console.error('[cta-track]', err);
    return jsonResponse({ error: 'Internal error' }, 500, origin);
  }
}
