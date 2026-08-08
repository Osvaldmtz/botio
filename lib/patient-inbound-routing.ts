import { shouldInterceptAdminTrialActivation } from '@/lib/admin-trial-parsing';
import { isTeamOperatorPhone } from '@/lib/team-members';

/**
 * Patient-inbound must not swallow team-operator traffic or admin trial commands.
 * Those continue to processIncomingMessage (admin trial interceptor / Sofía).
 */
export function shouldBypassPatientInbound(params: {
  senderPhone: string;
  messageBody: string;
}): boolean {
  if (isTeamOperatorPhone(params.senderPhone)) return true;
  if (shouldInterceptAdminTrialActivation(params.messageBody)) return true;
  return false;
}
