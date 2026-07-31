/**
 * One-time script to obtain GOOGLE_ADS_REFRESH_TOKEN.
 *
 * Prerequisites:
 * 1. Create OAuth 2.0 Client ID (Desktop app) in Google Cloud Console
 * 2. Enable Google Ads API in the project
 * 3. Set GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET in .env.local
 *
 * Run:
 *   npx tsx scripts/google-ads-oauth.ts
 *
 * Open the printed URL, authorize, paste the code when prompted.
 * Copy the refresh_token into Vercel as GOOGLE_ADS_REFRESH_TOKEN.
 */
import { config } from 'dotenv';
import { createServer } from 'node:http';
import { URL } from 'node:url';
import { OAuth2Client } from 'google-auth-library';

config({ path: process.env.DOTENV_CONFIG_PATH ?? '.env.local' });

const SCOPES = ['https://www.googleapis.com/auth/adwords'];
const REDIRECT_URI = 'http://127.0.0.1:53682/oauth2callback';

function readAuthCodeArg(): string | null {
  const flag = process.argv.find((arg) => arg.startsWith('--code='));
  return flag ? flag.slice('--code='.length).trim() : null;
}

async function exchangeCode(oauth2: OAuth2Client, code: string): Promise<void> {
  const { tokens } = await oauth2.getToken(code);
  console.log('\n✅ Tokens obtained:\n');
  console.log('GOOGLE_ADS_REFRESH_TOKEN=' + tokens.refresh_token);
  if (!tokens.refresh_token) {
    console.warn('\n⚠️  No refresh_token returned. Revoke app access and re-run with prompt=consent.');
  }
  console.log('\nAdd to Vercel Botio env vars along with DEVELOPER_TOKEN and CUSTOMER_ID.\n');
}

async function main() {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    console.error('Set GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET in .env.local');
    process.exit(1);
  }

  const oauth2 = new OAuth2Client(clientId, clientSecret, REDIRECT_URI);
  const authCode = readAuthCodeArg();
  if (authCode) {
    await exchangeCode(oauth2, authCode);
    return;
  }
  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });

  console.log('\n1. Open this URL in your browser:\n');
  console.log(authUrl);
  console.log('\n2. After authorizing, you will be redirected to localhost.\n');

  await new Promise<void>((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url ?? '/', `http://127.0.0.1:53682`);
        if (url.pathname !== '/oauth2callback') {
          res.writeHead(404);
          res.end('Not found');
          return;
        }

        const code = url.searchParams.get('code');
        const oauthError = url.searchParams.get('error');
        if (oauthError) {
          res.writeHead(400);
          res.end(`OAuth error: ${oauthError}`);
          reject(new Error(oauthError));
          server.close();
          return;
        }

        if (!code) {
          res.writeHead(400);
          res.end('Missing code');
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>OK — you can close this tab.</h1><p>Check the terminal for your refresh token.</p>');

        await exchangeCode(oauth2, code);
        server.close();
        resolve();
      } catch (err) {
        reject(err);
        server.close();
      }
    });

    server.listen(53682, '127.0.0.1', () => {
      console.log('Waiting for OAuth callback on http://127.0.0.1:53682/oauth2callback …');
    });
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
