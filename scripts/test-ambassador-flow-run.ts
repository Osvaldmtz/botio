import { detectAmbassadorIntent } from '../lib/intent-detector';
import {
  LUMA_WEBINAR_URL,
  MEET_LINK_BLOCKED_RESPONSE,
  matchEmbajadorFaq,
  matchesAmbassadorFaqSignal,
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
  assert(introReply?.faqId === 'intro_embajador', 'generic intro matches intro FAQ');
  assert(Boolean(introReply?.replyText.includes(LUMA_WEBINAR_URL)), 'intro has Luma');
  assert(EMBAJADOR_SYSTEM_PROMPT.includes(LUMA_WEBINAR_URL), 'ambassador prompt has Luma');

  const prodMsg =
    'Hola, soy estudiante de psicología y vi el anuncio sobre el programa de embajadores';
  assert(detectAmbassadorIntent(prodMsg) === 'embajador_program', 'prod message detected');
  const prodReply = buildAmbassadorReply(prodMsg, ambassadorState());
  assert(prodReply?.faqId === 'intro_embajador', 'prod message gets intro FAQ');
  assert(Boolean(prodReply?.sentLumaLink), 'prod message sends Luma');
  console.log('✓ estudiante + anuncio embajadores → intent + intro FAQ + Luma');

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

  const webinarAlone = 'webinar';
  assert(matchesAmbassadorFaqSignal(webinarAlone), 'webinar alone matches FAQ signal');
  assert(
    detectAmbassadorIntent(webinarAlone) === 'embajador_program' ||
      matchesAmbassadorFaqSignal(webinarAlone),
    'webinar alone should mark ambassador lead',
  );
  const webinarAloneReply = buildAmbassadorReply(webinarAlone, ambassadorState());
  assert(webinarAloneReply?.faqId === 'webinar_info', 'webinar alone gets webinar_info FAQ');
  assert(Boolean(webinarAloneReply?.replyText.includes(LUMA_WEBINAR_URL)), 'webinar alone has Luma');
  console.log('✓ "webinar" sola → FAQ signal + mark lead + webinar_info (sin A/B)');

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

  // Fix 1 — Caso Marlon: "Plataforma" dispara que_es_kalyo, que no tiene Luma en su texto base.
  // sentLumaLink debe ser true porque appendWebinarOfferIfNeeded añade el link al replyText final.
  const plataforma = 'Plataforma';
  assert(matchesAmbassadorFaqSignal(plataforma), 'plataforma matches ambassador FAQ signal');
  const plataformaReply = buildAmbassadorReply(plataforma, ambassadorState());
  assert(plataformaReply?.faqId === 'que_es_kalyo', 'plataforma gets que_es_kalyo FAQ');
  assert(
    Boolean(plataformaReply?.replyText.includes(LUMA_WEBINAR_URL)),
    'que_es_kalyo replyText includes Luma (appended)',
  );
  assert(
    plataformaReply?.sentLumaLink === true,
    'que_es_kalyo sentLumaLink=true when Luma is appended (regression: Marlon bug)',
  );
  console.log('✓ "Plataforma" → que_es_kalyo FAQ + Luma appended + sentLumaLink=true (Fix 1)');

  // Trigger gaps — cuanto_gano
  const cuantoPuedoGanar = 'Cuánto puedo ganar?';
  const cuantoPuedoGanarFaq = matchEmbajadorFaq(cuantoPuedoGanar);
  assert(cuantoPuedoGanarFaq?.id === 'cuanto_gano', '"Cuánto puedo ganar?" must match cuanto_gano FAQ');
  const cuantoPuedoGanarReply = buildAmbassadorReply(cuantoPuedoGanar, ambassadorState());
  assert(Boolean(cuantoPuedoGanarReply?.sentLumaLink), '"Cuánto puedo ganar?" sentLumaLink=true');
  console.log('✓ "Cuánto puedo ganar?" → cuanto_gano FAQ + sentLumaLink=true (trigger gap fix)');

  const quePuedoGanar = 'Qué puedo ganar siendo embajador?';
  const quePuedoGanarFaq = matchEmbajadorFaq(quePuedoGanar);
  assert(quePuedoGanarFaq?.id === 'cuanto_gano', '"Qué puedo ganar?" must match cuanto_gano FAQ');
  console.log('✓ "Qué puedo ganar siendo embajador?" → cuanto_gano FAQ (trigger gap fix)');

  // Trigger gaps — inversion
  const esGratis = 'Es gratis inscribirse?';
  const esGratisFaq = matchEmbajadorFaq(esGratis);
  assert(esGratisFaq?.id === 'inversion', '"Es gratis inscribirse?" must match inversion FAQ');
  console.log('✓ "Es gratis inscribirse?" → inversion FAQ (trigger gap fix)');

  // Trigger gaps — experiencia
  const sinVentas = 'Soy nuevo en ventas, puedo ser embajador?';
  const sinVentasFaq = matchEmbajadorFaq(sinVentas);
  assert(sinVentasFaq?.id === 'experiencia', '"Soy nuevo en ventas" must match experiencia FAQ');
  console.log('✓ "Soy nuevo en ventas, puedo ser embajador?" → experiencia FAQ (trigger gap fix)');

  // Trigger gaps — no_conozco
  const noAmigos = 'No tengo amigos psicólogos, cómo los consigo?';
  const noAmigosFaq = matchEmbajadorFaq(noAmigos);
  assert(noAmigosFaq?.id === 'no_conozco', '"No tengo amigos psicólogos" must match no_conozco FAQ');
  console.log('✓ "No tengo amigos psicólogos" → no_conozco FAQ (trigger gap fix)');

  console.log('\nAll ambassador flow tests passed.');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
