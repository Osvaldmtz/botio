import 'server-only';
import { Client, Receiver } from '@upstash/qstash';

export function getQstashClient(): Client | null {
  const token = process.env.QSTASH_TOKEN;
  if (!token) return null;
  return new Client({ token });
}

export function getQstashReceiver(): Receiver | null {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!currentSigningKey || !nextSigningKey) return null;
  return new Receiver({ currentSigningKey, nextSigningKey });
}

export function getAppBaseUrl(): string {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, '')}`;
  }
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'https://botio.dgx.agency').replace(/\/$/, '');
}
