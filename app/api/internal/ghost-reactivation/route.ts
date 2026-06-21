import 'server-only';
import { NextResponse } from 'next/server';
import { processGhostReactivationStep } from '@/lib/ghost-reactivation';
import { getQstashReceiver } from '@/lib/qstash-client';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const receiver = getQstashReceiver();
  if (!receiver) {
    console.error('[ghost-reactivation] missing QStash signing keys');
    return NextResponse.json({ error: 'QStash not configured' }, { status: 503 });
  }

  const body = await request.text();
  const signature = request.headers.get('Upstash-Signature') ?? '';

  try {
    const isValid = await receiver.verify({ body, signature });
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  } catch (error) {
    console.error('[ghost-reactivation] signature verification failed', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let conversationId = '';
  let botId = '';
  let step = 0;

  try {
    const payload = JSON.parse(body) as {
      conversationId?: string;
      botId?: string;
      step?: number;
    };
    conversationId =
      typeof payload.conversationId === 'string' ? payload.conversationId.trim() : '';
    botId = typeof payload.botId === 'string' ? payload.botId.trim() : '';
    step = typeof payload.step === 'number' ? payload.step : 0;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!conversationId || !botId || ![1, 2, 3].includes(step)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const result = await processGhostReactivationStep(
      supabase,
      conversationId,
      botId,
      step,
    );
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[ghost-reactivation] handler failed', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
