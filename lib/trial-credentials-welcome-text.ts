import { type TrialPlanChoice } from '@/lib/kalyo-trial-plans';
import { buildImmediateWelcomeMessage } from '@/lib/kalyo-trial-messages';

/**
 * Pure welcome body for a newly created trial account.
 * Guarantees the temp password appears via formatWhatsAppTempPasswordBlock.
 */
export function buildTrialTempPasswordWelcomeText(params: {
  name: string;
  email: string;
  trialEndsAt: string;
  tempPassword: string;
  trialPlan?: TrialPlanChoice;
}): string {
  const tempPassword = params.tempPassword.trim();
  if (!tempPassword) {
    throw new Error('tempPassword is required for credentials welcome');
  }

  return buildImmediateWelcomeMessage(params.name.trim() || 'Doctor/a', {
    email: params.email.trim().toLowerCase(),
    tempPassword,
    trialEndsAt: params.trialEndsAt,
    trialPlan: params.trialPlan ?? 'max',
  });
}
