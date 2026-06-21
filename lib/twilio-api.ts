import 'server-only';
import twilio from 'twilio';
import { format, subDays } from 'date-fns';
import { createAdminClient } from '@/lib/supabase/admin';

const TRACKED_NUMBERS: Array<{ number: string; label: string }> = [
  { number: '+15559374917', label: 'Sofía/Botio' },
  { number: '+17373667277', label: 'Kalyo recordatorios' },
];

type DailyBucket = {
  date: string;
  phone_number: string;
  phone_label: string;
  total_sent: number;
  delivered: number;
  failed: number;
  undelivered: number;
  total_cost_usd: number;
};

function normalizePhone(from: string): string {
  const digits = from.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return from.startsWith('+') ? from : `+${digits}`;
}

function bucketKey(date: string, phone: string): string {
  return `${date}|${phone}`;
}

export async function syncTwilioMetrics(): Promise<{
  rowsUpserted: number;
  days: number;
}> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN');
  }

  const client = twilio(accountSid, authToken);
  const since = subDays(new Date(), 30);
  const buckets = new Map<string, DailyBucket>();

  for (const tracked of TRACKED_NUMBERS) {
    const from = `whatsapp:${tracked.number}`;
    let messages;
    try {
      messages = await client.messages.list({
        from,
        dateSentAfter: since,
        limit: 1000,
      });
    } catch {
      continue;
    }

    for (const msg of messages) {
      if (!msg.dateSent) continue;
      const date = format(msg.dateSent, 'yyyy-MM-dd');
      const phone = normalizePhone(tracked.number);
      const key = bucketKey(date, phone);
      const bucket =
        buckets.get(key) ??
        ({
          date,
          phone_number: phone,
          phone_label: tracked.label,
          total_sent: 0,
          delivered: 0,
          failed: 0,
          undelivered: 0,
          total_cost_usd: 0,
        } satisfies DailyBucket);

      bucket.total_sent += 1;
      const status = (msg.status ?? '').toLowerCase();
      if (status === 'delivered' || status === 'read') bucket.delivered += 1;
      else if (status === 'failed') bucket.failed += 1;
      else if (status === 'undelivered') bucket.undelivered += 1;

      const price = Math.abs(Number(msg.price) || 0);
      bucket.total_cost_usd += price;
      buckets.set(key, bucket);
    }
  }

  const supabase = createAdminClient();
  const rows = Array.from(buckets.values()).map((b) => {
    const delivery_rate =
      b.total_sent > 0 ? Number(((b.delivered / b.total_sent) * 100).toFixed(2)) : 0;
    return {
      date: b.date,
      phone_number: b.phone_number,
      phone_label: b.phone_label,
      total_sent: b.total_sent,
      delivered: b.delivered,
      failed: b.failed,
      undelivered: b.undelivered,
      delivery_rate,
      total_cost_usd: Number(b.total_cost_usd.toFixed(4)),
      synced_at: new Date().toISOString(),
    };
  });

  if (rows.length > 0) {
    const { error } = await supabase.from('twilio_metrics').upsert(rows, {
      onConflict: 'date,phone_number',
    });
    if (error) throw error;
  }

  return { rowsUpserted: rows.length, days: 30 };
}
