import type { SupabaseClient } from '@supabase/supabase-js';
import type { CalendarSlot } from '@/lib/google-calendar';
import {
  getCustomerTimezone,
  getCustomerTimezoneLabel,
} from '@/lib/timezone-from-phone';

const WELCOME_DEMO_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const WELCOME_DEMO_DURATION_MINUTES = 30;
const WELCOME_DEMO_MIN_ADVANCE_MS = 12 * 60 * 60 * 1000;

/** Soft CTA block with Calendar slots (legacy / optional embed). */
export function formatTrialWelcomeDemoBlock(
  slots: Array<{ label_es: string }>,
): string {
  const usable = slots.filter((s) => s.label_es?.trim());
  if (usable.length === 0) return '';

  const lines = usable
    .slice(0, 3)
    .map((slot, i) => `${i + 1}. ${slot.label_es}`)
    .join('\n');

  return (
    `Para que aproveches al máximo tu prueba, te puedo mostrar Kalyo en vivo en 30 minutos. Tengo estos horarios:\n\n` +
    `${lines}\n\n` +
    `Responde 1, 2 o 3 para agendar. O si prefieres explorar por tu cuenta, entra a app.kalyo.io y crea tu primer paciente.`
  );
}

/**
 * Follow-up sent right after welcome + credentials.
 * Yes → demo slots / kalyo.io/demo via detectDemoIntent path.
 */
export function buildTrialDemoFollowUpOfferMessage(): string {
  return (
    `¿Te gustaría agendar una demo de 20 minutos para que te mostremos todo lo que puedes hacer con Kalyo? ` +
    `Te ayudamos a configurar tu cuenta y resolver dudas en vivo. 📅\n\n` +
    `Responde:\n` +
    `1️⃣ Sí, quiero una demo\n` +
    `2️⃣ No por ahora, exploraré solo`
  );
}

export function buildTrialDemoOfferDeclineAck(): string {
  return (
    `Perfecto. Explora a tu ritmo — cualquier duda durante la prueba, escríbeme. ` +
    `Si más adelante quieres la demo, solo dime. 🚀`
  );
}

/** Accept after trial demo follow-up (incl. bare "sí" / "1"). */
export function detectTrialDemoOfferAccept(message: string): boolean {
  const msg = message.toLowerCase().trim();
  if (!msg) return false;
  if (detectTrialDemoOfferDecline(msg)) return false;

  if (/^(1|1️⃣)([\s!.]*)$/.test(msg)) return true;
  if (/^(s[ií]|dale|va|claro|ok|okay|por\s+favor)([\s!.]*)$/i.test(msg)) return true;
  if (/\bs[ií],?\s+quiero\s+(una\s+)?demo\b/i.test(msg)) return true;
  if (/\bquiero\s+(una\s+)?demo\b/i.test(msg)) return true;
  if (/\bagendar\s+(una\s+)?demo\b/i.test(msg)) return true;
  return false;
}

/** Decline after trial demo follow-up (incl. bare "no" / "2"). */
export function detectTrialDemoOfferDecline(message: string): boolean {
  const msg = message.toLowerCase().trim();
  if (!msg) return false;

  if (/^(2|2️⃣)([\s!.]*)$/.test(msg)) return true;
  if (/no\s+por\s+ahora/i.test(msg)) return true;
  if (/explorar[eé]\s+solo/i.test(msg)) return true;
  if (/^(no|nel|nop|nah|ahora\s+no)([\s!.]*)$/i.test(msg)) return true;
  return false;
}

export function isTrialDemoOfferPending(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  return (
    metadata?.trial_demo_offer_pending === true ||
    metadata?.trial_demo_offer_pending === 'true'
  );
}

/**
 * Fetch up to 3 demo slots for welcome offer.
 * Returns [] on Calendar/OAuth failure (welcome must not break).
 */
export async function fetchTrialWelcomeDemoSlots(params?: {
  customerPhone?: string | null;
}): Promise<CalendarSlot[]> {
  const phone = params?.customerPhone?.trim() || undefined;
  const timezone = getCustomerTimezone(phone);
  const label = getCustomerTimezoneLabel(phone);

  try {
    const { getAvailableSlots } = await import('@/lib/google-calendar');
    const startDate = new Date(Date.now() + WELCOME_DEMO_MIN_ADVANCE_MS);
    const endDate = new Date(startDate.getTime() + WELCOME_DEMO_WINDOW_MS);
    const { slots } = await getAvailableSlots({
      startDate,
      endDate,
      durationMinutes: WELCOME_DEMO_DURATION_MINUTES,
      customerPhone: phone,
      customerTimezone: timezone,
      customerLabel: label,
    });
    return slots.slice(0, 3);
  } catch (err) {
    console.warn(
      '[trial-welcome-demo] Calendar unavailable — welcome without demo offer',
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

export async function saveTrialWelcomePendingDemoSlots(params: {
  supabase: SupabaseClient;
  conversationId: string;
  slots: CalendarSlot[];
  customerEmail: string;
  customerName: string;
  customerPhone?: string | null;
}): Promise<void> {
  if (params.slots.length === 0) return;

  const { savePendingDemoSlots } = await import('@/lib/demo-conversation');
  const phone = params.customerPhone?.trim() || undefined;
  const timezone = getCustomerTimezone(phone);
  const label = getCustomerTimezoneLabel(phone);

  await savePendingDemoSlots(params.supabase, params.conversationId, {
    slots: params.slots,
    customer_email: params.customerEmail.trim(),
    customer_name: params.customerName.trim() || 'Lead WhatsApp',
    customer_phone: phone,
    customer_timezone: timezone,
    customer_city_label: label,
    display_timezone: timezone,
    display_label: label,
    offered_at: new Date().toISOString(),
  });
}

export async function setTrialDemoOfferPending(
  supabase: SupabaseClient,
  conversationId: string,
  pending: boolean,
): Promise<void> {
  const { data: row, error: fetchError } = await supabase
    .from('conversations')
    .select('metadata')
    .eq('id', conversationId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);

  const metadata = {
    ...((row?.metadata as Record<string, unknown> | null) ?? {}),
  };

  if (pending) {
    metadata.trial_demo_offer_pending = true;
    metadata.trial_demo_offer_at = new Date().toISOString();
  } else {
    delete metadata.trial_demo_offer_pending;
  }

  const { error } = await supabase
    .from('conversations')
    .update({ metadata })
    .eq('id', conversationId);

  if (error) throw new Error(error.message);
}
