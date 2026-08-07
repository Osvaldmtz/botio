import 'server-only';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ResendEvent = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
  };
};

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'Missing RESEND_WEBHOOK_SECRET' },
      { status: 500 },
    );
  }

  const payload = await request.text();
  const id = request.headers.get('svix-id');
  const timestamp = request.headers.get('svix-timestamp');
  const signature = request.headers.get('svix-signature');

  if (!id || !timestamp || !signature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 });
  }

  let event: ResendEvent;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder');
    event = resend.webhooks.verify({
      payload,
      headers: {
        id,
        timestamp,
        signature,
      },
      webhookSecret: secret,
    }) as ResendEvent;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[emailing/webhook] verify failed', message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const emailId = event.data?.email_id;
  if (!emailId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const supabase = createAdminClient();
  const now = event.created_at ?? new Date().toISOString();

  try {
    if (event.type === 'email.opened') {
      await supabase
        .from('email_logs')
        .update({ status: 'opened', opened_at: now })
        .eq('resend_id', emailId)
        .neq('status', 'bounced');
    } else if (
      event.type === 'email.bounced' ||
      event.type === 'email.failed'
    ) {
      await supabase
        .from('email_logs')
        .update({ status: 'bounced' })
        .eq('resend_id', emailId);
    } else if (event.type === 'email.clicked') {
      await supabase
        .from('email_logs')
        .update({ clicked_at: now })
        .eq('resend_id', emailId);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[emailing/webhook] update failed', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
