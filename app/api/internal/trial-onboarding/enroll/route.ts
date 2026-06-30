import 'server-only';
import { NextResponse } from 'next/server';
import {
  enrollTrialDirect,
  validateTrialEnrollDirectBody,
} from '@/lib/trial-enroll-direct';
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

function isDirectEnrollBody(body: unknown): boolean {
  return (
    typeof body === 'object' &&
    body !== null &&
    'is_new_account' in body &&
    typeof (body as Record<string, unknown>).is_new_account === 'boolean'
  );
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized', step: 'validation' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON body', step: 'validation' },
      { status: 400 },
    );
  }

  if (isDirectEnrollBody(body)) {
    const validated = validateTrialEnrollDirectBody(body);
    if (!validated.ok) {
      const message =
        validated.error === 'phone must be valid E.164 format'
          ? 'WhatsApp inválido. Formato: +52 55 1234 5678'
          : validated.error;
      return NextResponse.json(
        { ok: false, error: message, step: validated.step },
        { status: 400 },
      );
    }

    try {
      const result = await enrollTrialDirect(validated.data);

      if (!result.ok) {
        const status =
          result.step === 'validation'
            ? 400
            : result.step === 'twilio'
              ? 500
              : 500;
        return NextResponse.json(result, { status });
      }

      return NextResponse.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[trial-enroll-direct] error | message=', message);
      return NextResponse.json(
        { ok: false, error: message, step: 'enrollment' },
        { status: 500 },
      );
    }
  }

  const validated = validateTrialEnrollBody(body);
  if (!validated.ok) {
    const message =
      validated.error === 'phone must be valid E.164 format'
        ? 'WhatsApp inválido. Formato: +52 55 1234 5678'
        : validated.error;
    return NextResponse.json(
      { ok: false, error: message, step: 'validation' },
      { status: 400 },
    );
  }

  try {
    const result = await enrollTrialFromKalyoWebhook(validated.data);

    if (!result.success) {
      return NextResponse.json(
        { ok: false, error: result.reason, step: 'enrollment' },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      conversation_id: result.conversation_id,
      enrollment_id: result.trial_onboarding_id,
      trial_ends_at: result.trial_ends_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[trial-onboarding-webhook] error | message=', message);
    return NextResponse.json(
      { ok: false, error: message, step: 'enrollment' },
      { status: 500 },
    );
  }
}
