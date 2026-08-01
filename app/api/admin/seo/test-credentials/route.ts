import 'server-only';

import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { getAuthHeader, isDataForSeoConfigured } from '@/lib/dataforseo-api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TEST_ENDPOINT =
  'https://api.dataforseo.com/v3/dataforseo_labs/google/domain_rank_overview/live';

export async function POST() {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isDataForSeoConfigured()) {
    return NextResponse.json(
      { error: 'Missing DATAFORSEO_LOGIN or DATAFORSEO_PASSWORD' },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(TEST_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        {
          target: 'kalyo.io',
          location_code: 2484,
          language_code: 'es',
        },
      ]),
      cache: 'no-store',
    });

    const responseBody = await res.text().catch(() => '');

    let body: unknown = responseBody;
    try {
      body = JSON.parse(responseBody);
    } catch {
      // keep raw text
    }

    return NextResponse.json({
      httpStatus: res.status,
      body,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[admin/seo/test-credentials] failed', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
