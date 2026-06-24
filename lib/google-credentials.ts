import 'server-only';
import type { JWTInput } from 'google-auth-library';

/** Parse GOOGLE_CREDENTIALS_JSON from env (handles Vercel quoting / double-encoding). */
export function parseGoogleCredentialsJson(): JWTInput {
  const raw = process.env.GOOGLE_CREDENTIALS_JSON?.trim();
  if (!raw) throw new Error('Missing GOOGLE_CREDENTIALS_JSON');

  let value = raw;
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed === 'string') {
      return JSON.parse(parsed) as JWTInput;
    }
    return parsed as JWTInput;
  } catch {
    throw new Error('Invalid GOOGLE_CREDENTIALS_JSON: must be valid JSON');
  }
}
