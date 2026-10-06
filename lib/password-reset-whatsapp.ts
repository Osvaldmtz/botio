import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateKalyoPassword, formatWhatsAppTempPasswordBlock } from '@/lib/kalyo-password';
import { getKalyoClient } from '@/lib/kalyo-supabase';
import { detectPasswordResetRequest } from '@/lib/password-reset-detector';
import { normalizePhone } from '@/lib/phone';

const COOLDOWN_MS = 15 * 60 * 1000;

export type PasswordResetWhatsAppResult = {
  replyText: string;
  source: 'password_reset_whatsapp';
  email: string;
  reset: boolean;
};

type PsychRow = {
  id: string;
  auth_id: string | null;
  email: string;
  full_name: string | null;
  phone: string | null;
};

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, '');
}

function phoneMatchVariants(phone: string): string[] {
  const digits = digitsOnly(phone);
  const variants = new Set<string>();
  if (!digits) return [];
  variants.add(digits);
  variants.add(`+${digits}`);
  // MX mobile often stored with/without extra 1 after country code
  if (digits.startsWith('521') && digits.length >= 13) {
    const withoutOne = `52${digits.slice(3)}`;
    variants.add(withoutOne);
    variants.add(`+${withoutOne}`);
  }
  if (digits.startsWith('52') && !digits.startsWith('521') && digits.length >= 12) {
    const withOne = `521${digits.slice(2)}`;
    variants.add(withOne);
    variants.add(`+${withOne}`);
  }
  return Array.from(variants);
}

function readCooldownAt(metadata: Record<string, unknown> | null | undefined): number | null {
  const raw = metadata?.password_reset_whatsapp_at;
  if (typeof raw !== 'string') return null;
  const ts = Date.parse(raw);
  return Number.isFinite(ts) ? ts : null;
}

async function findPsychologistByPhone(phone: string): Promise<PsychRow | null> {
  const kalyo = getKalyoClient();
  const variants = phoneMatchVariants(normalizePhone(phone) || phone);

  for (const variant of variants) {
    const { data, error } = await kalyo
      .from('psychologists')
      .select('id, auth_id, email, full_name, phone')
      .eq('phone', variant)
      .maybeSingle();
    if (error) {
      console.error('[password-reset-wa] psych lookup failed', error.message);
      continue;
    }
    if (data) return data as PsychRow;
  }

  // Fallback: ilike on trailing national digits (last 10)
  const digits = digitsOnly(phone);
  const national = digits.length >= 10 ? digits.slice(-10) : digits;
  if (national.length >= 10) {
    const { data, error } = await kalyo
      .from('psychologists')
      .select('id, auth_id, email, full_name, phone')
      .ilike('phone', `%${national}`)
      .limit(3);
    if (error) {
      console.error('[password-reset-wa] psych ilike failed', error.message);
      return null;
    }
    if (data && data.length === 1) return data[0] as PsychRow;
  }

  return null;
}

function buildSuccessMessage(email: string, password: string, name?: string | null): string {
  const first = name?.trim().split(/\s+/)[0];
  const greeting = first ? `Listo, ${first}` : 'Listo';
  return (
    `${greeting}. Te reseté el acceso por WhatsApp (el correo a veces no llega):\n\n` +
    `🌐 https://app.kalyo.io/login\n` +
    `📧 ${email}\n` +
    formatWhatsAppTempPasswordBlock(password) +
    `\nCámbiala al entrar en Configuración. Cualquier cosa, aquí estoy.`
  );
}

function buildNotFoundMessage(): string {
  return (
    `Para resetear tu acceso necesito confirmar la cuenta.\n\n` +
    `Escríbeme el email con el que te registraste en Kalyo y lo resolvemos aquí mismo 🙏`
  );
}

function buildNoAuthMessage(email: string): string {
  return (
    `Encontré la cuenta ${email}, pero no tiene login auth vinculado.\n` +
    `Un humano del equipo lo revisa — también puedes escribir a +52 811 411 2000.`
  );
}

/**
 * WhatsApp fallback for password reset (avoids broken/slow Auth recovery emails).
 * Generates a new temp password, updates auth.users, and replies with credentials.
 */
export async function handlePasswordResetWhatsApp(params: {
  supabase: SupabaseClient;
  conversationId: string;
  customerPhone: string;
  messageBody: string;
  metadata?: Record<string, unknown> | null;
  isAmbassadorLead?: boolean;
  isTeamMember?: boolean;
}): Promise<PasswordResetWhatsAppResult | null> {
  if (params.isAmbassadorLead || params.isTeamMember) return null;
  if (!detectPasswordResetRequest(params.messageBody)) return null;

  const lastAt = readCooldownAt(params.metadata ?? null);
  if (lastAt && Date.now() - lastAt < COOLDOWN_MS) {
    return {
      replyText:
        'Ya te envié una contraseña nueva hace poco. Revisa el mensaje anterior (cópiala tal cual) o espera unos minutos e inténtalo de nuevo.',
      source: 'password_reset_whatsapp',
      email: '',
      reset: false,
    };
  }

  let psych = await findPsychologistByPhone(params.customerPhone);

  // If user included an email in the message, prefer that match
  const emailInMsg = params.messageBody.match(/[\w.+-]+@[\w.-]+\.\w+/i)?.[0]?.toLowerCase();
  if (emailInMsg) {
    const kalyo = getKalyoClient();
    const { data } = await kalyo
      .from('psychologists')
      .select('id, auth_id, email, full_name, phone')
      .ilike('email', emailInMsg)
      .maybeSingle();
    if (data) psych = data as PsychRow;
  }

  if (!psych) {
    return {
      replyText: buildNotFoundMessage(),
      source: 'password_reset_whatsapp',
      email: '',
      reset: false,
    };
  }

  if (!psych.auth_id) {
    return {
      replyText: buildNoAuthMessage(psych.email),
      source: 'password_reset_whatsapp',
      email: psych.email,
      reset: false,
    };
  }

  const password = generateKalyoPassword();
  const kalyo = getKalyoClient();
  const { error: pwError } = await kalyo.auth.admin.updateUserById(psych.auth_id, {
    password,
    email_confirm: true,
  });

  if (pwError) {
    console.error('[password-reset-wa] updateUserById failed', pwError.message);
    return {
      replyText:
        'No pude resetear la contraseña automáticamente. Un humano del equipo te ayuda en un momento — o escribe a +52 811 411 2000.',
      source: 'password_reset_whatsapp',
      email: psych.email,
      reset: false,
    };
  }

  const nowIso = new Date().toISOString();
  const nextMeta = {
    ...(params.metadata ?? {}),
    password_reset_whatsapp_at: nowIso,
    password_reset_whatsapp_email: psych.email,
  };
  await params.supabase
    .from('conversations')
    .update({ metadata: nextMeta })
    .eq('id', params.conversationId);

  console.log(
    `[password-reset-wa] reset ok | conv=${params.conversationId} | email=${psych.email} | phone=${params.customerPhone}`,
  );

  return {
    replyText: buildSuccessMessage(psych.email, password, psych.full_name),
    source: 'password_reset_whatsapp',
    email: psych.email,
    reset: true,
  };
}
