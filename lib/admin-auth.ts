import 'server-only';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'botio_admin';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function isAdmin(): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const value = cookies().get(COOKIE_NAME)?.value;
  return value === expected;
}

export function setAdminCookie(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || password !== expected) return false;
  cookies().set({
    name: COOKIE_NAME,
    value: password,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
  return true;
}

export function clearAdminCookie() {
  cookies().set({
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
