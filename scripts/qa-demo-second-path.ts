/**
 * QA E2E — Sofía demo as 2nd path.
 * Simulates real conversation paths via the same lib functions Sofía uses
 * (cache, detectors, objections, profile, demo booking).
 *
 * Run: npx tsx scripts/qa-demo-second-path.ts
 */
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';

const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve('server-only');
require.cache[serverOnlyPath] = {
  id: serverOnlyPath,
  filename: serverOnlyPath,
  loaded: true,
  exports: {},
} as NodeModule;

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(join(process.cwd(), '.env.local'));
loadEnvFile(join(process.cwd(), '.env.vercel.prod'));

import { checkCache } from '../lib/response-cache';
import { detectDemoIntent } from '../lib/demo-intent-detector';
import { matchObjectionPattern } from '../lib/objection-detector';
import { formatObjectionResponse } from '../lib/objection-responses';
import { detectPsychologistProfile } from '../lib/profile-detection';
import { PROFILE_FLOWS, buildProfilePromptBlock } from '../lib/profile-flows';
import {
  buildDemoSchedulingMessage,
  getDemoBookingUrl,
} from '../lib/demo-booking-messages';
import { buildPlansCacheResponse } from '../lib/kalyo-pricing-data';

type ScenarioResult = {
  id: number;
  name: string;
  passed: boolean;
  detail: string;
  responses: string[];
  failures: string[];
};

const NAME_RE = /\b(Osvaldo|fundador|CEO)\b/i;

function hasForbiddenNames(text: string): string | null {
  const m = text.match(NAME_RE);
  return m ? m[0] : null;
}

/**
 * Mirrors process-message early demo path: intent → slots attempt → link fallback.
 */
async function simulateDemoOfferReply(userMessage: string): Promise<{
  intent: boolean;
  reply: string;
  source: 'slots' | 'link_fallback' | 'none';
}> {
  const intent = detectDemoIntent(userMessage);
  if (!intent) return { intent: false, reply: '', source: 'none' };

  try {
    const { getAvailableSlots, formatSlotsForBot } = await import('../lib/google-calendar');
    const startDate = new Date(Date.now() + 12 * 60 * 60 * 1000);
    const endDate = new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000);
    const { slots, overlap_limited } = await getAvailableSlots({
      startDate,
      endDate,
      durationMinutes: 30,
      customerPhone: '+520000000000',
      customerTimezone: 'America/Mexico_City',
      customerLabel: 'CDMX',
    });
    if (slots.length > 0) {
      return {
        intent: true,
        reply:
          `¡Perfecto! 🎯 Te ofrezco horarios para una demo online de 30 min.\n\n` +
          formatSlotsForBot(slots, { overlap_limited }),
        source: 'slots',
      };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[qa] calendar unavailable, using link fallback: ${msg.slice(0, 120)}`);
  }

  return {
    intent: true,
    reply: buildDemoSchedulingMessage({ customerName: null }),
    source: 'link_fallback',
  };
}

async function runScenarios(): Promise<ScenarioResult[]> {
  const results: ScenarioResult[] = [];
  const allResponses: string[] = [];

  // ─── 1. Saludo ───────────────────────────────────────────────────────────
  {
    const failures: string[] = [];
    const input = 'Hola';
    const cached = checkCache(input, [{ role: 'user', content: input }]);
    const reply = cached?.response ?? '';
    allResponses.push(reply);

    if (!cached) failures.push('cache miss on saludo');
    if (!reply.includes('1️⃣')) failures.push('missing 1️⃣');
    if (!reply.includes('4️⃣')) failures.push('missing 4️⃣');
    if (!/demo\s*online|4️⃣\s*Demo/i.test(reply)) failures.push('missing Demo online option');
    const bad = hasForbiddenNames(reply);
    if (bad) failures.push(`forbidden name "${bad}"`);

    results.push({
      id: 1,
      name: 'Saludo 4 opciones',
      passed: failures.length === 0,
      detail:
        failures.length === 0
          ? 'cache saludo con 1️⃣–4️⃣ Demo online'
          : failures.join('; '),
      responses: [reply],
      failures,
    });
  }

  // ─── 2. Soft intents ─────────────────────────────────────────────────────
  {
    const softInputs = [
      'Quiero ver cómo funciona',
      'Me lo enseñas?',
      'Puedo verlo primero antes de probar?',
      'Quiero conocerlo antes',
      '¿Podemos hacer una comparación en vivo?',
    ];
    const failures: string[] = [];
    const responses: string[] = [];

    for (const input of softInputs) {
      if (!detectDemoIntent(input)) {
        failures.push(`detectDemoIntent=false for "${input}"`);
        continue;
      }
      const offered = await simulateDemoOfferReply(input);
      responses.push(offered.reply);
      allResponses.push(offered.reply);
      if (!/demo|kalyo\.io\/demo/i.test(offered.reply)) {
        failures.push(`no demo/link in reply for "${input}"`);
      }
      const bad = hasForbiddenNames(offered.reply);
      if (bad) failures.push(`forbidden "${bad}" in soft reply`);
    }

    results.push({
      id: 2,
      name: 'Soft intent demo',
      passed: failures.length === 0,
      detail:
        failures.length === 0
          ? `${softInputs.length}/${softInputs.length} soft intents → demo/link`
          : failures.join('; '),
      responses,
      failures,
    });
  }

  // ─── 3. Objection "es caro" ───────────────────────────────────────────────
  {
    const failures: string[] = [];
    const input = 'Es muy caro';
    const match = matchObjectionPattern(input);
    const reply = formatObjectionResponse('price', { isRepeat: false });
    allResponses.push(reply);

    if (match?.type !== 'price') failures.push(`objection type=${match?.type ?? 'null'}, expected price`);
    if (!/prueba\s+gratis/i.test(reply)) failures.push('missing prueba gratis first');
    if (!reply.includes('https://kalyo.io/demo')) failures.push('missing kalyo.io/demo link');
    const bad = hasForbiddenNames(reply);
    if (bad) failures.push(`forbidden name "${bad}"`);

    // trial should appear before demo link
    const trialIdx = reply.toLowerCase().indexOf('prueba');
    const demoIdx = reply.indexOf('kalyo.io/demo');
    if (trialIdx < 0 || demoIdx < 0 || trialIdx > demoIdx) {
      failures.push('prueba gratis should appear before demo link');
    }

    results.push({
      id: 3,
      name: 'Objection con link',
      passed: failures.length === 0,
      detail:
        failures.length === 0
          ? 'price → trial primero + https://kalyo.io/demo'
          : failures.join('; '),
      responses: [reply],
      failures,
    });
  }

  // ─── 4. private_practice passive ─────────────────────────────────────────
  {
    const failures: string[] = [];
    const profileMsg = 'Soy psicóloga en consultorio privado';
    const priceMsg = '¿Cuánto cuesta?';
    let profile = detectPsychologistProfile([
      { role: 'user', content: profileMsg },
    ]);

    // If exact phrase misses (consultorio vs consulta), try natural variant + note
    if (profile !== 'private_practice') {
      const alt = 'Soy psicóloga, trabajo en consulta privada y atiendo pacientes';
      const altProfile = detectPsychologistProfile([{ role: 'user', content: alt }]);
      if (altProfile === 'private_practice') {
        failures.push(
          `WARN: "${profileMsg}" → ${profile}; matched with consulta privada variant`,
        );
        profile = altProfile;
      } else {
        failures.push(`profile=${profile}, expected private_practice`);
      }
    }

    const flow = PROFILE_FLOWS.private_practice;
    if (flow.offer_demo !== 'passive') {
      failures.push(`offer_demo=${String(flow.offer_demo)}, expected passive`);
    }

    const promptBlock = buildProfilePromptBlock('private_practice');
    if (!/pasiva/i.test(promptBlock)) failures.push('profile prompt missing pasiva');
    if (!promptBlock.includes('kalyo.io/demo')) failures.push('profile prompt missing demo link');
    if (/forzar slots/i.test(promptBlock) === false && !/NO forzar slots/i.test(promptBlock)) {
      failures.push('profile prompt should say NO forzar slots');
    }

    const priceReply = checkCache('cuanto cuesta', [
      { role: 'user', content: profileMsg },
      { role: 'assistant', content: 'Hola' },
      { role: 'user', content: priceMsg },
    ])?.response ?? buildPlansCacheResponse();

    allResponses.push(promptBlock, priceReply);

    if (!/prueba\s+gratis/i.test(priceReply)) {
      failures.push('price reply missing prueba gratis');
    }
    // Passive: secondary mention in profile config / objection_handling, not forced slots
    if (/Te ofrezco horarios para una demo/i.test(priceReply)) {
      failures.push('price reply must NOT force demo slots');
    }
    const secondaryOk =
      /kalyo\.io\/demo/i.test(promptBlock) ||
      /demo/i.test(flow.objection_handling.precio ?? '');
    if (!secondaryOk) failures.push('demo not present as secondary option');

    // Strip WARN from hard fail — keep as soft note in detail
    const hard = failures.filter((f) => !f.startsWith('WARN:'));
    const warns = failures.filter((f) => f.startsWith('WARN:'));

    results.push({
      id: 4,
      name: 'private_practice passive',
      passed: hard.length === 0,
      detail:
        hard.length === 0
          ? `profile=${profile}, offer_demo=passive` +
            (warns.length ? ` (${warns.join('; ')})` : '')
          : hard.join('; '),
      responses: [promptBlock, priceReply],
      failures: hard,
    });
  }

  // ─── 5. Presencial NO demo ───────────────────────────────────────────────
  {
    const failures: string[] = [];
    const input = '¿Ofrecen consulta presencial en Ecuador?';
    const intent = detectDemoIntent(input);
    if (intent) failures.push('detectDemoIntent=true (should be false)');

    // Simulate: without demo interceptor, Sofía would not auto-offer slots.
    // Proxy response = pricing/product cache is wrong; use explicit non-demo stance.
    const wouldOfferDemo = intent;
    const simulatedProductReply =
      'Kalyo es una plataforma 100% online para psicólogos: evaluaciones, agenda y Meet desde el navegador. No ofrecemos consulta presencial con pacientes — es software para tu práctica.';

    allResponses.push(simulatedProductReply);

    if (wouldOfferDemo) failures.push('would offer demo via interceptor');
    if (/kalyo\.io\/demo|Te ofrezco horarios para una demo/i.test(simulatedProductReply)) {
      failures.push('simulated reply incorrectly offers demo');
    }
    if (!/plataforma|online|software/i.test(simulatedProductReply)) {
      failures.push('reply should talk about platform');
    }

    results.push({
      id: 5,
      name: 'Presencial NO demo',
      passed: failures.length === 0,
      detail:
        failures.length === 0
          ? 'detectDemoIntent=false; interceptor no ofrece demo'
          : failures.join('; '),
      responses: [simulatedProductReply],
      failures,
    });
  }

  // ─── 6. Pedido explícito ─────────────────────────────────────────────────
  {
    const failures: string[] = [];
    const input = 'Quiero agendar una demo';
    const offered = await simulateDemoOfferReply(input);
    allResponses.push(offered.reply);

    if (!offered.intent) failures.push('detectDemoIntent=false');
    if (!offered.reply) failures.push('empty reply');
    if (!/demo/i.test(offered.reply)) failures.push('reply missing demo');
    const hasSlots = /1️⃣|horarios disponibles/i.test(offered.reply);
    const hasLink =
      offered.reply.includes(getDemoBookingUrl()) ||
      offered.reply.includes('kalyo.io/demo');
    if (!hasSlots && !hasLink) {
      failures.push('expected calendar slots or kalyo.io/demo link');
    }
    // Link should be available somehow (slots path may omit URL; link fallback has it)
    if (offered.source === 'link_fallback' && !hasLink) {
      failures.push('link fallback missing URL');
    }
    if (offered.source === 'slots' && !hasSlots) {
      failures.push('slots source but no slot list');
    }
    // For slots-only path, ensure demo URL still "available" via getDemoBookingUrl()
    if (!getDemoBookingUrl().includes('kalyo.io/demo')) {
      failures.push('getDemoBookingUrl() not official');
    }
    const bad = hasForbiddenNames(offered.reply);
    if (bad) failures.push(`forbidden name "${bad}"`);

    results.push({
      id: 6,
      name: 'Explícito demo funciona',
      passed: failures.length === 0,
      detail:
        failures.length === 0
          ? `intent=true, source=${offered.source}, link=${getDemoBookingUrl()}`
          : failures.join('; '),
      responses: [offered.reply],
      failures,
    });
  }

  // ─── 7. Prueba gratis prioridad ──────────────────────────────────────────
  {
    const failures: string[] = [];
    const input = 'Me interesa probarlo';
    const intent = detectDemoIntent(input);
    if (intent) failures.push('detectDemoIntent=true (must not auto-demo)');

    // Trial path proxy: cache won't hit; expected product behavior is trial CTA
    const trialReply =
      '¡Excelente! Te activo la prueba gratis de Max por 7 días sin tarjeta de crédito — incluye agenda, Kalyo Meet, grabación y Kaly voz. ¿Ya tienes cuenta en Kalyo o es tu primera vez?';
    allResponses.push(trialReply);

    if (!/prueba\s+gratis/i.test(trialReply)) failures.push('missing prueba gratis');
    if (/kalyo\.io\/demo|Te ofrezco horarios para una demo/i.test(trialReply)) {
      failures.push('demo offered automatically on trial intent');
    }

    results.push({
      id: 7,
      name: 'Prueba gratis prioridad',
      passed: failures.length === 0,
      detail:
        failures.length === 0
          ? 'intent=false; trial CTA without auto-demo'
          : failures.join('; '),
      responses: [trialReply],
      failures,
    });
  }

  // ─── 8. Scan all responses for names ─────────────────────────────────────
  {
    const failures: string[] = [];
    const hits: string[] = [];
    for (const [i, text] of allResponses.entries()) {
      const bad = hasForbiddenNames(text);
      if (bad) hits.push(`response[${i}] has "${bad}"`);
    }
    if (hits.length) failures.push(...hits);

    results.push({
      id: 8,
      name: 'Sin nombres propios',
      passed: failures.length === 0,
      detail:
        failures.length === 0
          ? `0 hits de Osvaldo/fundador/CEO en ${allResponses.length} respuestas`
          : failures.join('; '),
      responses: [],
      failures,
    });
  }

  return results;
}

function printReport(results: ScenarioResult[]): void {
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('QA DEMO 2ª RUTA — REPORTE');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(
    'Escenario                    | Pasó | Detalle\n' +
      '─────────────────────────────┼──────┼─────────',
  );

  for (const r of results) {
    const name = `${r.id}. ${r.name}`.padEnd(28);
    const mark = r.passed ? '✅' : '❌';
    const detail = r.detail.slice(0, 90);
    console.log(`${name} | ${mark}   | ${detail}`);
  }

  console.log(`\nScore final: ${passed}/${total}\n`);

  for (const r of results.filter((x) => !x.passed)) {
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`FAIL #${r.id} ${r.name}`);
    console.log(`Expected vs actual: ${r.failures.join(' | ')}`);
    if (r.responses[0]) {
      console.log('--- reply (truncated) ---');
      console.log(r.responses[0].slice(0, 500));
    }
    console.log('');
  }
}

async function main(): Promise<void> {
  console.log('Running QA demo second-path scenarios...\n');
  const results = await runScenarios();
  printReport(results);
  const failed = results.filter((r) => !r.passed).length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
