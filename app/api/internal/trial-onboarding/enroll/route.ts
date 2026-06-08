import 'server-only';
import { NextResponse } from 'next/server';
import {
  enrollTrialFromKalyoWebhook,
  validateTrialEnrollBody,
} from '@/lib/trial-onboarding-webhook';

export const dynamic = 'force-dynamic';

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET ?? process.env.BOTIO_WEBHOOK_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const validated = validateTrialEnrollBody(body);
  if (!validated.ok) {
    const message =
      validated.error === 'phone must be valid E.164 format'
        ? 'WhatsApp inválido. Formato: +52 55 1234 5678'
        : validated.error;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const result = await enrollTrialFromKalyoWebhook(validated.data);

    if (!result.success) {
      return NextResponse.json(
        { success: false, reason: result.reason },
        { status: 409 },
      );
    }

    return NextResponse.json({
      success: true,
      trial_onboarding_id: result.trial_onboarding_id,
      conversation_id: result.conversation_id,
      trial_ends_at: result.trial_ends_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[trial-onboarding-webhook] error | message=', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
