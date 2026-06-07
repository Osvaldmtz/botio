import 'server-only';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  DEMO_HOST_EMAIL,
  exchangeCodeForTokens,
  persistCalendarCredentials,
} from '@/lib/google-calendar';

export const dynamic = 'force-dynamic';

const STATE_COOKIE = 'google_calendar_oauth_state';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://botio.dgx.agency';
  const settingsUrl = `${baseUrl}/admin/calendar-settings`;

  if (error) {
    return NextResponse.redirect(`${settingsUrl}?error=${encodeURIComponent(error)}`);
  }

  const savedState = cookies().get(STATE_COOKIE)?.value;
  cookies().set({ name: STATE_COOKIE, value: '', maxAge: 0, path: '/' });

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(`${settingsUrl}?error=invalid_oauth_state`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    await persistCalendarCredentials({
      hostEmail: DEMO_HOST_EMAIL,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
    });

    return NextResponse.redirect(`${settingsUrl}?connected=1`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'oauth_failed';
    console.error('[google-calendar/callback] failed', err);
    return NextResponse.redirect(`${settingsUrl}?error=${encodeURIComponent(message)}`);
  }
}
