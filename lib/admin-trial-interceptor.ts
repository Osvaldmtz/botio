import { executeAdminActivateTrialForLead } from '@/lib/admin-trial-activation';
import {
  adminTrialPhoneValidationError,
  parseAdminTrialRequestFromMessages,
  parseAdminTrialRequestFromText,
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

function validationErrorResult(error: string, replyText: string): AdminTrialInterceptResult {
  return {
    replyText,
    source: 'admin_trial_interceptor',
    toolsCalled: ['admin_activate_trial_for_lead'],
    toolResults: {
      admin_activate_trial_for_lead: { status: 'validation_error', error },
    },
  };
}

export async function handleAdminTrialActivationMessage(params: {
  messageBody: string;
  conversationMessages: Array<{ role: string; content: string }>;
}): Promise<AdminTrialInterceptResult | null> {
  const historyAlreadyHasCurrent =
    params.conversationMessages.at(-1)?.role === 'user' &&
    params.conversationMessages.at(-1)?.content === params.messageBody;

  const allMessages = historyAlreadyHasCurrent
    ? params.conversationMessages
    : [...params.conversationMessages, { role: 'user', content: params.messageBody }];

  if (!shouldInterceptAdminTrialActivation(params.messageBody, params.conversationMessages)) {
    return null;
  }

  const partial = parseAdminTrialRequestFromText(params.messageBody);
  const phoneError = adminTrialPhoneValidationError(partial);
  if (phoneError) {
    console.log(
      `[admin-trial-interceptor] rejected | reason=missing_or_invalid_phone | email=${partial.email ?? '—'}`,
    );
    return validationErrorResult('missing_or_invalid_phone', phoneError);
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
