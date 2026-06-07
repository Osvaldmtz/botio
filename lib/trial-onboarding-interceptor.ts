import type { SupabaseClient } from '@supabase/supabase-js';
import { formatPayIntentReply } from '@/lib/kalyo-payment-links';
import type { NotifySalesCreds } from '@/lib/kalyo-notify';

const UNSUBSCRIBE_RE =
  /\b(?:stop|unsubscribe|no\s+m[aá]s\s+mensajes|para\s+de\s+escribirme|deja\s+de\s+escribir)\b/i;

const PAY_INTENT_RE =
  /^(?:s[ií]|si|yes|ok|dale|de\s+acuerdo)$|quiero\s+pagar|quiero\s+continuar|activar(?:me)?\s+(?:el\s+)?(?:plan\s+)?pro|link\s+de\s+pago/i;

export type TrialOnboardingInterceptResult = {
  replyText: string;
  source: 'trial_onboarding';
  action: 'unsubscribed' | 'pay_intent' | 'engagement';
};

export type TrialOnboardingActiveRow = {
  id: string;
  trial_user_email: string;
  trial_user_name: string | null;
  day_13_sent_at: string | null;
  day_15_sent_at: string | null;
  customer_responded: boolean;
};

export async function loadActiveTrialOnboarding(
  supabase: SupabaseClient,
  customerPhone: string,
): Promise<TrialOnboardingActiveRow | null> {
  const { data, error } = await supabase
    .from('trial_onboarding_messages')
    .select('id, trial_user_email, trial_user_name, day_13_sent_at, day_15_sent_at, customer_responded')
    .eq('customer_phone', customerPhone)
    .eq('unsubscribed', false)
    .is('upgraded_to_paid_at', null)
    .gte('trial_ends_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as TrialOnboardingActiveRow | null) ?? null;
}

export function isUnsubscribeMessage(messageBody: string): boolean {
  return UNSUBSCRIBE_RE.test(messageBody.trim());
}

export function isPayIntentMessage(messageBody: string): boolean {
  return PAY_INTENT_RE.test(messageBody.trim());
}

async function maybeNotifyPayIntent(
  creds: NotifySalesCreds | null,
  input: {
    name?: string | null;
    email: string;
    phone: string;
    conversationId: string;
  },
): Promise<void> {
  if (!creds) return;
  const { notifySalesTeam } = await import('@/lib/kalyo-notify');
  await notifySalesTeam(
    {
      name: input.name ?? undefined,
      email: input.email,
      phone: input.phone,
      whatsapp_number: input.phone,
      reason: 'trial_user_wants_to_pay',
      conversation_summary: 'Cliente en trial pidió continuar / link de pago tras mensaje día 13+',
      conversationId: input.conversationId,
    },
    creds,
  );
}

export async function handleTrialOnboardingMessage(params: {
  supabase: SupabaseClient;
  conversationId: string;
  customerPhone: string;
  messageBody: string;
  creds: NotifySalesCreds | null;
}): Promise<TrialOnboardingInterceptResult | null> {
  const row = await loadActiveTrialOnboarding(params.supabase, params.customerPhone);
  if (!row) return null;

  if (isUnsubscribeMessage(params.messageBody)) {
    await params.supabase
      .from('trial_onboarding_messages')
      .update({ unsubscribed: true })
      .eq('id', row.id);

    console.log(`[trial-onboarding] customer unsubscribed | phone=${params.customerPhone}`);

    return {
      replyText:
        'Listo, no te mando más mensajes automáticos. Si quieres ayuda con Kalyo, escríbeme cuando quieras.',
      source: 'trial_onboarding',
      action: 'unsubscribed',
    };
  }

  if (isPayIntentMessage(params.messageBody) && row.day_13_sent_at) {
    await params.supabase
      .from('trial_onboarding_messages')
      .update({ customer_responded: true })
      .eq('id', row.id);

    await maybeNotifyPayIntent(params.creds, {
      name: row.trial_user_name,
      email: row.trial_user_email,
      phone: params.customerPhone,
      conversationId: params.conversationId,
    });

    return {
      replyText: formatPayIntentReply({
        trialUserName: row.trial_user_name,
        trialUserEmail: row.trial_user_email,
        day15SentAt: row.day_15_sent_at,
      }),
      source: 'trial_onboarding',
      action: 'pay_intent',
    };
  }

  if (!row.customer_responded) {
    await params.supabase
      .from('trial_onboarding_messages')
      .update({ customer_responded: true })
      .eq('id', row.id);
  }

  return null;
}
