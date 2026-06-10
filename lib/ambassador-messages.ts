import {
  EMBAJADOR_FAQS,
  LUMA_WEBINAR_URL,
  MEET_LINK_BLOCKED_RESPONSE,
  WEBINAR_OFFER_SUFFIX,
  matchEmbajadorFaq,
  responseContainsLumaLink,
  wantsDirectMeetLink,
  wantsWebinarRegistration,
} from '@/lib/embajador-faqs';

export type AmbassadorMessageState = {
  webinarLinkSentAt: string | null;
};

export type AmbassadorMessageResult = {
  replyText: string;
  source: 'ambassador_faq' | 'ambassador_guard';
  faqId?: string;
  sentLumaLink: boolean;
};

function appendWebinarOfferIfNeeded(
  response: string,
  webinarLinkSentAt: string | null,
): string {
  if (webinarLinkSentAt || responseContainsLumaLink(response)) {
    return response;
  }
  return `${response}${WEBINAR_OFFER_SUFFIX}`;
}

export function buildAmbassadorReply(
  messageBody: string,
  state: AmbassadorMessageState,
): AmbassadorMessageResult | null {
  if (wantsDirectMeetLink(messageBody)) {
    return {
      replyText: MEET_LINK_BLOCKED_RESPONSE,
      source: 'ambassador_guard',
      sentLumaLink: true,
    };
  }

  const faq = matchEmbajadorFaq(messageBody);
  if (faq) {
    return {
      replyText: appendWebinarOfferIfNeeded(faq.response, state.webinarLinkSentAt),
      source: 'ambassador_faq',
      faqId: faq.id,
      sentLumaLink: responseContainsLumaLink(faq.response),
    };
  }

  if (wantsWebinarRegistration(messageBody)) {
    const webinarFaq = EMBAJADOR_FAQS.find((item) => item.id === 'webinar_info');
    return {
      replyText: webinarFaq?.response ?? `Regístrate gratis aquí 👇\n${LUMA_WEBINAR_URL}`,
      source: 'ambassador_faq',
      faqId: 'webinar_info',
      sentLumaLink: true,
    };
  }

  return null;
}
