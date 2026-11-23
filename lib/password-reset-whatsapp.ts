import type { SupabaseClient } from '@supabase/supabase-js';
import { generateKalyoPassword, formatWhatsAppTempPasswordBlock } from '@/lib/kalyo-password';
import { getKalyoClient } from '@/lib/kalyo-supabase';
import {
  detectPasswordResetConfirm,
  detectPasswordResetRequest,
} from '@/lib/password-reset-detector';
import { normalizePhone } from '@/lib/phone';

const COOLDOWN_MS = 15 * 60 * 1000;
export const FRESH_ACCOUNT_MS = 24 * 60 * 60 * 1000;
export const FORGOT_PASSWORD_URL = 'https://app.kalyo.io/login?mode=forgot';

export type PasswordResetWhatsAppResult = {
  replyText: string;
  source: 'password_reset_whatsapp';
  email: string;
  reset: boolean;
  /** True when we asked for confirmation instead of rotating. */
  pendingConfirm?: boolean;
  /** True when we resent the stored welcome without rotating. */
  resentWelcome?: boolean;
};

type PsychRow = {
  id: string;
  auth_id: string | null;
  email: string;
  full_name: string | null;
  phone: string | null;
};

type AuthSignInInfo = {
  created_at: string | null;
  last_sign_in_at: string | null;
};

export type PasswordResetWhatsAppDeps = {
  findPsychologistByPhone: (phone: string) => Promise<PsychRow | null>;
  findPsychologistByEmail: (email: string) => Promise<PsychRow | null>;
  getAuthSignInInfo: (authId: string) => Promise<AuthSignInInfo | null>;
  findStoredWelcomeMessage: (conversationId: string) => Promise<string | null>;
  updatePassword: (authId: string, password: string) => Promise<{ error: string | null }>;
  updateConversationMetadata: (
    conversationId: string,
    metadata: Record<string, unknown>,
  ) => Promise<void>;
  now?: () => number;
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

export function isFreshNeverSignedInAccount(
  info: AuthSignInInfo | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!info?.created_at) return false;
  if (info.last_sign_in_at) return false;
  const created = Date.parse(info.created_at);
  if (!Number.isFinite(created)) return false;
  return nowMs - created < FRESH_ACCOUNT_MS;
}

export function buildAskConfirmMessage(email: string, name?: string | null): string {
  const first = name?.trim().split(/\s+/)[0];
  const greeting = first ? `${first}, ` : '';
  return (
    `${greeting}¿Quieres que te envíe una contraseña nueva?\n\n` +
    `Responde "sí" o "manda nueva" y te la mando aquí.\n` +
    `También puedes restablecerla en ${FORGOT_PASSWORD_URL}\n` +
    `(Cuenta: ${email})`
  );
}

export function buildResendWelcomeMessage(welcomeBody: string | null, email: string): string {
  const header =
    `Tu cuenta es nueva y todavía no has iniciado sesión.\n` +
    `Usa la contraseña del mensaje de bienvenida (la reenvío abajo; no generé otra clave).\n` +
    `Si no la encuentras: ${FORGOT_PASSWORD_URL}\n` +
    `📧 ${email}\n`;

  if (welcomeBody?.trim()) {
    return `${header}\n---\n${welcomeBody.trim()}`;
  }

  return (
    `${header}\n` +
    `No encontré el mensaje de bienvenida en el chat. Revisa el de Sofía con tus credenciales, ` +
    `o restablece la contraseña en el link de arriba.`
  );
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

async function defaultFindPsychologistByPhone(phone: string): Promise<PsychRow | null> {
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

async function defaultFindPsychologistByEmail(email: string): Promise<PsychRow | null> {
  const kalyo = getKalyoClient();
  const { data } = await kalyo
    .from('psychologists')
    .select('id, auth_id, email, full_name, phone')
    .ilike('email', email)
    .maybeSingle();
  return (data as PsychRow | null) ?? null;
}

async function defaultGetAuthSignInInfo(authId: string): Promise<AuthSignInInfo | null> {
  const kalyo = getKalyoClient();
  const { data, error } = await kalyo.auth.admin.getUserById(authId);
  if (error || !data.user) {
    console.error('[password-reset-wa] getUserById failed', error?.message);
    return null;
  }
  return {
    created_at: data.user.created_at ?? null,
    last_sign_in_at: data.user.last_sign_in_at ?? null,
  };
}

async function defaultFindStoredWelcomeMessage(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('messages')
    .select('content')
    .eq('conversation_id', conversationId)
    .eq('role', 'assistant')
    .contains('metadata', { source: 'trial_onboarding_welcome' })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[password-reset-wa] welcome lookup failed', error.message);
    return null;
  }
  return typeof data?.content === 'string' ? data.content : null;
}

async function defaultUpdatePassword(
  authId: string,
  password: string,
): Promise<{ error: string | null }> {
  const kalyo = getKalyoClient();
  const { error } = await kalyo.auth.admin.updateUserById(authId, {
    password,
    email_confirm: true,
  });
  return { error: error?.message ?? null };
}

/**
 * WhatsApp fallback for password reset (avoids broken/slow Auth recovery emails).
 * Fresh accounts (<24h, never signed in) get the stored welcome resent — no rotate.
 * Others are asked to confirm before rotating.
 */
export async function handlePasswordResetWhatsApp(params: {
  supabase: SupabaseClient;
  conversationId: string;
  customerPhone: string;
  messageBody: string;
  metadata?: Record<string, unknown> | null;
  isAmbassadorLead?: boolean;
  isTeamMember?: boolean;
  deps?: Partial<PasswordResetWhatsAppDeps>;
}): Promise<PasswordResetWhatsAppResult | null> {
  if (params.isAmbassadorLead || params.isTeamMember) return null;

  const now = params.deps?.now ?? Date.now;
  const metadata = { ...(params.metadata ?? {}) };
  const pendingConfirm = metadata.password_reset_pending_confirm === true;
  const wantsConfirm = detectPasswordResetConfirm(params.messageBody);
  const wantsReset = detectPasswordResetRequest(params.messageBody);

  if (!pendingConfirm && !wantsReset) return null;
  if (pendingConfirm && !wantsConfirm && !wantsReset) return null;

  const deps: PasswordResetWhatsAppDeps = {
    findPsychologistByPhone:
      params.deps?.findPsychologistByPhone ?? defaultFindPsychologistByPhone,
    findPsychologistByEmail:
      params.deps?.findPsychologistByEmail ?? defaultFindPsychologistByEmail,
    getAuthSignInInfo: params.deps?.getAuthSignInInfo ?? defaultGetAuthSignInInfo,
    findStoredWelcomeMessage:
      params.deps?.findStoredWelcomeMessage ??
      ((conversationId) => defaultFindStoredWelcomeMessage(params.supabase, conversationId)),
    updatePassword: params.deps?.updatePassword ?? defaultUpdatePassword,
    updateConversationMetadata:
      params.deps?.updateConversationMetadata ??
      (async (conversationId, nextMeta) => {
        await params.supabase
          .from('conversations')
          .update({ metadata: nextMeta })
          .eq('id', conversationId);
      }),
    now,
  };

  const lastAt = readCooldownAt(metadata);
  const confirmingRotate = pendingConfirm && wantsConfirm;
  if (confirmingRotate && lastAt && now() - lastAt < COOLDOWN_MS) {
    return {
      replyText:
        'Ya te envié una contraseña nueva hace poco. Revisa el mensaje anterior (cópiala tal cual) o espera unos minutos e inténtalo de nuevo.',
      source: 'password_reset_whatsapp',
      email: typeof metadata.password_reset_whatsapp_email === 'string'
        ? metadata.password_reset_whatsapp_email
        : '',
      reset: false,
    };
  }

  let psych = await deps.findPsychologistByPhone(params.customerPhone);
  const emailInMsg = params.messageBody.match(/[\w.+-]+@[\w.-]+\.\w+/i)?.[0]?.toLowerCase();
  if (emailInMsg) {
    const byEmail = await deps.findPsychologistByEmail(emailInMsg);
    if (byEmail) psych = byEmail;
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

  const shouldRotate = confirmingRotate;

  if (!shouldRotate) {
    const authInfo = await deps.getAuthSignInInfo(psych.auth_id);
    if (isFreshNeverSignedInAccount(authInfo, now())) {
      const welcome = await deps.findStoredWelcomeMessage(params.conversationId);
      const nextMeta = {
        ...metadata,
        password_reset_pending_confirm: false,
        password_reset_welcome_resent_at: new Date(now()).toISOString(),
      };
      await deps.updateConversationMetadata(params.conversationId, nextMeta);
      return {
        replyText: buildResendWelcomeMessage(welcome, psych.email),
        source: 'password_reset_whatsapp',
        email: psych.email,
        reset: false,
        resentWelcome: true,
      };
    }

    const nextMeta = {
      ...metadata,
      password_reset_pending_confirm: true,
      password_reset_pending_email: psych.email,
    };
    await deps.updateConversationMetadata(params.conversationId, nextMeta);
    return {
      replyText: buildAskConfirmMessage(psych.email, psych.full_name),
      source: 'password_reset_whatsapp',
      email: psych.email,
      reset: false,
      pendingConfirm: true,
    };
  }

  const password = generateKalyoPassword();
  const { error: pwError } = await deps.updatePassword(psych.auth_id, password);

  if (pwError) {
    console.error('[password-reset-wa] updateUserById failed', pwError);
    return {
      replyText:
        'No pude resetear la contraseña automáticamente. Un humano del equipo te ayuda en un momento — o escribe a +52 811 411 2000.',
      source: 'password_reset_whatsapp',
      email: psych.email,
      reset: false,
    };
  }

  const nowIso = new Date(now()).toISOString();
  const nextMeta = {
    ...metadata,
    password_reset_whatsapp_at: nowIso,
    password_reset_whatsapp_email: psych.email,
    password_reset_pending_confirm: false,
  };
  await deps.updateConversationMetadata(params.conversationId, nextMeta);

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
