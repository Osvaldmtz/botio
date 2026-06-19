/**
 * Test: detección tardía de embajador (Fix 2 + trigger gaps)
 *
 * Simula process-message.ts L283-L350 sin APIs externas.
 * Incluye el fallback determinista de Fix 2: cuando buildAmbassadorReply
 * retorna null en la primera detección, el sistema fuerza intro_embajador.
 *
 * Escenarios originales del análisis (esperamos 8/8 PASS):
 *   A   "programa de embajadores"   → intro_embajador
 *   A2  "vi el anuncio"             → intro_embajador
 *   B   "Es para ganar dinero"      → Fix 2 fallback → intro_embajador
 *   B2  "ingreso extra"             → Fix 2 fallback → intro_embajador
 *   B3  "comisiones"                → cuanto_gano
 *   C   "Plataforma"  (Marlon/Fix1) → que_es_kalyo
 *   D   "Cuánto puedo ganar?"       → cuanto_gano (trigger gap fix)
 *   E   "webinar"                   → webinar_info
 *   F   control ambiguo             → no detectado ✓
 */

import { detectAmbassadorIntent, isLikelyClientPsychologist } from '../lib/intent-detector';
import {
  LUMA_WEBINAR_URL,
  matchEmbajadorFaq,
  matchesAmbassadorFaqSignal,
} from '../lib/embajador-faqs';
import { buildAmbassadorReply } from '../lib/ambassador-messages';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERT FAIL: ${message}`);
}

/** Replica de shouldMarkAmbassadorLead cuando isAmbassadorLead=false */
function shouldMarkAmbassadorLead(msg: string): boolean {
  if (isLikelyClientPsychologist(msg)) return false;
  return (
    detectAmbassadorIntent(msg) === 'embajador_program' ||
    matchesAmbassadorFaqSignal(msg)
  );
}

const EXPLICIT_AMBASSADOR_SIGNAL =
  /\b(embajador|comisi[óo]n|ganar\s+dinero|webinar\s+embajador|programa\s+de\s+embajadores|afiliado)\b/i;

/**
 * Simula el bloque de process-message.ts DESPUÉS de Fix 2.
 *
 * Flujo:
 *   1. shouldMarkAmbassadorLead(msg)
 *   2. buildAmbassadorReply(msg)                     ← FAQ específico
 *   3. Si null + wasJustDetected + !webinarSent       ← Fix 2
 *      → buildAmbassadorReply('programa de embajadores')  ← fallback intro
 *
 * Returns el resultado final y metadatos de diagnóstico.
 */
function simulateWithFix2(msg: string): {
  detected: boolean;
  specificFaqId: string | null;
  usedFix2Fallback: boolean;
  finalFaqId: string | null;
  replyText: string | null;
  lumaInReply: boolean;
  sentLumaLink: boolean;
  wouldMarkDB: boolean;
} {
  const detected = shouldMarkAmbassadorLead(msg);

  if (!detected) {
    return {
      detected: false,
      specificFaqId: null,
      usedFix2Fallback: false,
      finalFaqId: null,
      replyText: null,
      lumaInReply: false,
      sentLumaLink: false,
      wouldMarkDB: false,
    };
  }

  // Post-mark state: isAmbassadorLead=true, webinarLinkSentAt=null, wasJustDetected=true
  const state = { webinarLinkSentAt: null as string | null };

  const specificReply = buildAmbassadorReply(msg, state);
  const specificFaqId = specificReply?.faqId ?? null;

  // Fix 2: fallback when specific reply is null and this is first detection
  const wasJustDetected = true; // always true in late-detection scenario (prev state = client)
  let usedFix2Fallback = false;
  let finalReply = specificReply;

  const hasExplicitAmbassadorSignal = EXPLICIT_AMBASSADOR_SIGNAL.test(msg);

  if (
    !finalReply &&
    wasJustDetected &&
    hasExplicitAmbassadorSignal &&
    !state.webinarLinkSentAt
  ) {
    finalReply = buildAmbassadorReply('programa de embajadores', state);
    usedFix2Fallback = true;
  }

  const lumaInReply = finalReply?.replyText.includes(LUMA_WEBINAR_URL) ?? false;
  const sentLumaLink = finalReply?.sentLumaLink ?? false;

  return {
    detected,
    specificFaqId,
    usedFix2Fallback,
    finalFaqId: finalReply?.faqId ?? null,
    replyText: finalReply?.replyText ?? null,
    lumaInReply,
    sentLumaLink,
    wouldMarkDB: sentLumaLink,
  };
}

// ─── Runner ───────────────────────────────────────────────────────────────────

type Status = 'PASS' | 'FAIL_EXPECTED' | 'FAIL';

type Result = ReturnType<typeof simulateWithFix2> & {
  label: string;
  msg: string;
  status: Status;
  verdict: string;
};

function evaluate(label: string, msg: string, expectDetection: boolean): Result {
  const r = simulateWithFix2(msg);

  let status: Status;
  let verdict: string;

  if (!expectDetection) {
    status = r.detected ? 'FAIL' : 'FAIL_EXPECTED';
    verdict = r.detected
      ? 'ERROR: detectó embajador en mensaje de control ambiguo'
      : 'Correcto: mensaje ambiguo NO detectado';
  } else if (!r.detected) {
    status = 'FAIL';
    verdict = 'No detectado — shouldMarkAmbassadorLead=false';
  } else if (r.wouldMarkDB) {
    const via = r.usedFix2Fallback ? 'Fix 2 fallback' : `FAQ ${r.specificFaqId}`;
    verdict = `Detectado ✓ | ${via} → Luma ✓ | sentLumaLink=true → webinar_link_sent_at marcado ✓`;
    status = 'PASS';
  } else {
    status = 'FAIL';
    verdict = `Detectado pero Luma NO garantizado (sentLumaLink=${r.sentLumaLink}, faq=${r.finalFaqId ?? 'null'})`;
  }

  return { label, msg, status, verdict, ...r };
}

function print(r: Result): void {
  const icon = r.status === 'PASS' || r.status === 'FAIL_EXPECTED' ? '✅' : '❌';
  const fix2tag = r.usedFix2Fallback ? ' [Fix 2]' : '';

  console.log(`\n${icon} ${r.label}`);
  console.log(`   msg:            "${r.msg}"`);
  console.log(`   detected:       ${r.detected}`);
  console.log(`   specificFaq:    ${r.specificFaqId ?? '— (null)'}`);
  console.log(`   usedFix2:       ${r.usedFix2Fallback}${fix2tag}`);
  console.log(`   finalFaq:       ${r.finalFaqId ?? '— (null)'}`);
  console.log(`   sentLumaLink:   ${r.sentLumaLink}`);
  console.log(`   wouldMarkDB:    ${r.wouldMarkDB}`);
  console.log(`   → ${r.verdict}`);
}

function runTests(): void {
  console.log('=== Test: Detección tardía — Fix 2 + trigger gaps ===\n');

  const scenarios: Result[] = [
    evaluate('A   intro_embajador directo',    'Soy estudiante y quiero saber del programa de embajadores', true),
    evaluate('A2  "vi el anuncio"',            'Hola, vi el anuncio y me interesa ser embajadora',          true),
    evaluate('B   "Es para ganar dinero"',     'Es para ganar dinero',                                      true),
    evaluate('B2  "ingreso extra"',            'Busco un ingreso extra',                                    true),
    evaluate('B3  "comisiones"',               'Me interesan las comisiones',                               true),
    evaluate('C   "Plataforma" (Marlon/Fix1)', 'Plataforma',                                                true),
    evaluate('D   "Cuánto puedo ganar?"',      'Cuánto puedo ganar?',                                       true),
    evaluate('E   "webinar" solo',             'webinar',                                                   true),
    evaluate('F   control ambiguo',            'Hola, más información por favor',                           false),
  ];

  scenarios.forEach(print);

  // ─── Summary ──────────────────────────────────────────────────────────────
  const passes   = scenarios.filter((r) => r.status === 'PASS');
  const controls = scenarios.filter((r) => r.status === 'FAIL_EXPECTED');
  const fails    = scenarios.filter((r) => r.status === 'FAIL');
  const fix2used = scenarios.filter((r) => r.usedFix2Fallback);

  console.log('\n══════════════════════════════════════════════');
  console.log('RESUMEN (objetivo: 8/8 PASS + 1 control)');
  console.log('══════════════════════════════════════════════');
  console.log(`✅ PASS    (detectado + Luma + DB marcado): ${passes.length} / 8`);
  console.log(`✅ Control (ambiguo NO detectado):          ${controls.length} / 1`);
  console.log(`❌ FAIL    (problema real):                  ${fails.length}`);
  console.log(`🔀 Fix 2 activo (fallback intro_embajador): ${fix2used.length} escenarios`);

  if (fix2used.length > 0) {
    console.log('\n🔀 Escenarios rescatados por Fix 2:');
    fix2used.forEach((r) => console.log(`   ${r.label}: "${r.msg}"`));
  }

  if (fails.length > 0) {
    console.log('\n❌ Fallos:');
    fails.forEach((r) => console.log(`   ${r.label}: ${r.verdict}`));
  }

  // ─── Hard assertions ───────────────────────────────────────────────────────
  // B2 ("ingreso extra") detecta embajador pero ya no fuerza Luma — cae a Claude.
  const mainScenarios = scenarios.filter(
    (r) => !r.label.startsWith('F') && !r.label.startsWith('B2'),
  );
  const allPass = mainScenarios.every((r) => r.status === 'PASS');
  assert(allPass, `Escenarios principales deben ser PASS. Fallos: ${fails.map((r) => r.label).join(', ')}`);

  // Fix 1 regression
  const marlon = scenarios.find((r) => r.label.startsWith('C'));
  assert(marlon?.sentLumaLink === true,    'Fix 1 regression: que_es_kalyo sentLumaLink debe ser true');
  assert(marlon?.wouldMarkDB === true,     'Fix 1 regression: que_es_kalyo debe marcar DB');

  // Fix 2 coverage — only explicit ambassador signals trigger forced intro
  const ganarDinero = scenarios.find((r) => r.label.startsWith('B '));
  assert(ganarDinero?.usedFix2Fallback === true, 'Fix 2: "Es para ganar dinero" debe usar fallback intro_embajador');
  assert(ganarDinero?.wouldMarkDB === true, 'Fix 2: "Es para ganar dinero" debe marcar DB');

  const ingresoExtra = scenarios.find((r) => r.label.startsWith('B2'));
  assert(ingresoExtra?.detected === true, 'B2: "ingreso extra" sigue detectando embajador');
  assert(
    ingresoExtra?.usedFix2Fallback === false,
    'Fix 2 guard: "ingreso extra" ya NO fuerza intro sin señal explícita',
  );

  // Trigger gap fix — cuanto_gano
  const cuantoPuede = scenarios.find((r) => r.label.startsWith('D'));
  assert(cuantoPuede?.detected === true,           'Trigger fix: "Cuánto puedo ganar?" debe detectarse');
  assert(cuantoPuede?.finalFaqId === 'cuanto_gano','Trigger fix: "Cuánto puedo ganar?" debe matchear cuanto_gano');
  assert(cuantoPuede?.wouldMarkDB === true,         'Trigger fix: "Cuánto puedo ganar?" debe marcar DB');

  // Control
  const control = scenarios.find((r) => r.label.startsWith('F'));
  assert(control?.detected === false, 'Control: mensaje ambiguo NO debe detectar embajador');

  console.log('\n✅ Todos los hard assertions OK');
  console.log(`✅ ${mainScenarios.length}/${mainScenarios.length} escenarios principales PASS (+ B2 guard verificado)`);
}

runTests();
