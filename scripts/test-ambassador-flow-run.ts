import { detectAmbassadorIntent } from '../lib/intent-detector';
import {
  LUMA_WEBINAR_URL,
  MEET_LINK_BLOCKED_RESPONSE,
  matchEmbajadorFaq,
  responseContainsLumaLink,
  wantsDirectMeetLink,
} from '../lib/embajador-faqs';
import { buildAmbassadorReply } from '../lib/ambassador-messages';
import { EMBAJADOR_SYSTEM_PROMPT } from '../lib/embajador-prompt';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function ambassadorState() {
  return { webinarLinkSentAt: null };
}

async function runTests(): Promise<void> {
  console.log('Ambassador flow tests\n');

  const intro =
    'Hola, soy estudiante y vi su anuncio sobre embajadores';
  assert(detectAmbassadorIntent(intro) === 'embajador_program', 'detect embajador intent');
  const introReply = buildAmbassadorReply(intro, ambassadorState());
  assert(introReply === null, 'generic intro falls through to Claude');
  assert(EMBAJADOR_SYSTEM_PROMPT.includes(LUMA_WEBINAR_URL), 'ambassador prompt has Luma');
  console.log('✓ estudiante + anuncio embajadores → intent detectado, sin trial tools');

  const inversion = 'Cuánto pago por inscribirme?';
  const inversionReply = buildAmbassadorReply(inversion, ambassadorState());
  assert(inversionReply?.faqId === 'inversion', 'FAQ inversion matched');
  assert(
    Boolean(inversionReply?.replyText.includes(LUMA_WEBINAR_URL)),
    'FAQ inversion includes Luma link',
  );
  console.log('✓ FAQ inversion con link Luma');

  const webinar = 'Quiero registrarme al webinar';
  const webinarReply = buildAmbassadorReply(webinar, ambassadorState());
  assert(webinarReply?.sentLumaLink === true, 'webinar registration sends Luma');
  assert(Boolean(webinarReply?.replyText.includes(LUMA_WEBINAR_URL)), 'webinar reply has Luma');
  console.log('✓ registro webinar → link Luma + sentLumaLink');

  const meet = 'Dame el link del Meet por favor';
  assert(wantsDirectMeetLink(meet), 'detect meet request');
  const meetReply = buildAmbassadorReply(meet, ambassadorState());
  assert(meetReply?.source === 'ambassador_guard', 'meet blocked');
  assert(
    !meetReply?.replyText.includes('meet.google.com'),
    'meet link not exposed',
  );
  assert(Boolean(meetReply?.replyText.includes(LUMA_WEBINAR_URL)), 'redirect to Luma');
  assert(meetReply?.replyText === MEET_LINK_BLOCKED_RESPONSE, 'standard meet block copy');
  console.log('✓ Meet bloqueado → solo Luma');

  const faq = matchEmbajadorFaq('cuánto gano de comisión');
  assert(faq?.id === 'cuanto_gano', 'comision FAQ');
  assert(responseContainsLumaLink(faq?.response ?? ''), 'comision FAQ has luma');
  console.log('✓ FAQ comisiones');

  console.log('\nAll ambassador flow tests passed.');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
