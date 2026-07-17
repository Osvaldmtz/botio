import { executeAdminActivateTrialForLead } from '@/lib/admin-trial-activation';
import {
  parseAdminTrialRequestFromMessages,
  shouldInterceptAdminTrialActivation,
} from '@/lib/admin-trial-parsing';

export type AdminTrialInterceptResult = {
  replyText: string;
  source: 'admin_trial_interceptor';
  toolsCalled: ['admin_activate_trial_for_lead'];
  toolResults: {
    admin_activate_trial_for_lead: Record<string, unknown>;
  };
};

export async function handleAdminTrialActivationMessage(params: {
  messageBody: string;
  conversationMessages: Array<{ role: string; content: string }>;
}): Promise<AdminTrialInterceptResult | null> {
  const allMessages = [
    ...params.conversationMessages,
    { role: 'user', content: params.messageBody },
  ];

  if (!shouldInterceptAdminTrialActivation(params.messageBody, params.conversationMessages)) {
    return null;
  }

  const parsed = parseAdminTrialRequestFromMessages(allMessages);
  if (!parsed) return null;

  console.log(
    `[admin-trial-interceptor] activating trial | plan=${parsed.trialPlan} | email=${parsed.email} | phone=${parsed.phone} | name=${parsed.fullName}`,
  );

  const result = await executeAdminActivateTrialForLead({
    email: parsed.email,
    fullName: parsed.fullName,
    phone: parsed.phone,
    trialPlan: parsed.trialPlan,
    source: 'admin_via_botio_interceptor',
  });

  return {
    replyText: result.bot_message,
    source: 'admin_trial_interceptor',
    toolsCalled: ['admin_activate_trial_for_lead'],
    toolResults: {
      admin_activate_trial_for_lead: result as Record<string, unknown>,
    },
  };
}
