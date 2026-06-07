import 'server-only';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { isAdmin } from '@/lib/admin-auth';
import { getGoogleAuthUrl } from '@/lib/google-calendar';

export const dynamic = 'force-dynamic';

const STATE_COOKIE = 'google_calendar_oauth_state';

export async function GET() {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const state = randomBytes(16).toString('hex');
  cookies().set({
    name: STATE_COOKIE,
    value: state,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });

  const url = getGoogleAuthUrl(state);
  return NextResponse.redirect(url);
}
