import 'server-only';
import { google } from 'googleapis';

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name} — configura OAuth de Google Search Console en Vercel.`);
  }
  return value;
}

/** OAuth2 client; googleapis refreshes the access token automatically via refresh_token. */
export function getGscOAuthClient() {
  const client = new google.auth.OAuth2(
    requireEnv('GOOGLE_CLIENT_ID'),
    requireEnv('GOOGLE_CLIENT_SECRET'),
  );
  client.setCredentials({
    refresh_token: requireEnv('GOOGLE_REFRESH_TOKEN'),
  });
  return client;
}

export function getGscSearchConsoleClient() {
  const auth = getGscOAuthClient();
  return google.searchconsole({ version: 'v1', auth });
}

export const GSC_OAUTH_SCOPE = SCOPE;
