import { activateTrialForLead } from '@/lib/activate-trial-lead';
import { buildAdminOperatorTrialConfirmation } from '@/lib/kalyo-trial-messages';
import type { TrialPlanChoice } from '@/lib/kalyo-trial-plans';

export type AdminTrialActivationResponse = {
  status: string;
  bot_message: string;
  email?: string;
  phone?: string;
  trial_ends_at?: string;
  welcome_sent?: boolean;
  reactivated?: boolean;
  temp_password?: string;
  error?: string;
  detail?: string;
};

export async function executeAdminActivateTrialForLead(params: {
  email: string;
  fullName: string;
  phone: string;
  source?: string;
  trialPlan?: TrialPlanChoice;
}): Promise<AdminTrialActivationResponse> {
  const trialPlan = params.trialPlan ?? 'max';
  const result = await activateTrialForLead({
    email: params.email,
    fullName: params.fullName,
    phone: params.phone,
    source: params.source ?? 'admin_via_botio',
    trialPlan,
  });

  if (result.status === 'error') {
    if (result.error === 'trial_already_used') {
      return {
        status: 'trial_already_used',
        bot_message: `Ese email ya tiene trial activo o ya lo usó. Pide al psicólogo entrar en https://app.kalyo.io/login`,
      };
    }
    if (result.error === 'email_exists') {
      return {
        status: 'email_exists',
        bot_message: `El email ya existe en Kalyo. Si necesitas reactivar trial, revisa en Kaly Admin o pide al usuario hacer login.`,
      };
    }
    if (result.error === 'password_missing' || result.error === 'kalyo_verify_failed') {
      return {
        status: 'error',
        error: result.error,
        detail: result.detail,
        bot_message:
          `Error interno activando trial (${result.error}). NO confirmes éxito al operador. ` +
          `Detalle: ${result.detail ?? 'sin detalle'}. Reintenta o activa manualmente desde Kaly Admin.`,
      };
    }
    return {
      status: 'error',
      error: result.error,
      detail: result.detail,
      bot_message: `No pude activar el trial: ${result.error}. ${result.detail ?? ''}`.trim(),
    };
  }

  if (!result.temp_password) {
    return {
      status: 'error',
      error: 'password_missing',
      bot_message:
        'Error interno: el trial quedó sin contraseña temporal. NO confirmes éxito — reintenta la activación.',
    };
  }

  return {
    status: 'success',
    email: result.email,
    phone: result.phone,
    trial_ends_at: result.trial_ends_at,
    welcome_sent: result.welcome_sent,
    reactivated: result.reactivated,
    temp_password: result.temp_password,
    bot_message: buildAdminOperatorTrialConfirmation({
      fullName: params.fullName,
      email: result.email,
      phone: result.phone,
      trialEndsAt: result.trial_ends_at,
      tempPassword: result.temp_password,
      reactivated: result.reactivated,
      welcomeSent: result.welcome_sent,
      trialPlan,
    }),
  };
}
