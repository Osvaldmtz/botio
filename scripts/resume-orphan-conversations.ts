/**
 * Resume conversations that got Anthropic "credit balance too low" fallbacks.
 *
 *   npx tsx scripts/resume-orphan-conversations.ts              # dry-run
 *   npx tsx scripts/resume-orphan-conversations.ts --confirm    # send WA + DB
 */
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { buildStandardPricePresentation } from '../lib/kalyo-pricing-data';
import { buildTrialActivationSuccessMessage } from '../lib/kalyo-trial-messages';
import { buildTrialDemoFollowUpOfferMessage } from '../lib/trial-welcome-demo';

const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve('server-only');
require.cache[serverOnlyPath] = {
  id: serverOnlyPath,
  filename: serverOnlyPath,
  loaded: true,
  exports: {},
} as NodeModule;

function loadEnvLocal(): void {
  for (const name of ['.env.local', '.env.vercel.prod']) {
    const envPath = join(process.cwd(), name);
    if (!existsSync(envPath)) continue;
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
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
}

loadEnvLocal();

const CONFIRM = process.argv.includes('--confirm');
const FALLBACK_SNIPPET = 'estoy procesando tu mensaje';
const EXCLUDED = new Set(['+528114112000']);

type CaseKind =
  | 'pricing_after_trial'
  | 'greeting_options'
  | 'pricing'
  | 'activate_trial'
  | 'skip';

type OrphanCase = {
  phone: string;
  conversationId: string;
  kind: CaseKind;
  triggerUserMessage: string;
  skipReason?: string;
  notes?: string;
  trial?: { fullName: string; email: string };
};

const CASES: OrphanCase[] = [
  {
    phone: '+523334640609',
    conversationId: 'c35c6889-75b5-444d-bea7-9db31b8b4758',
    kind: 'pricing_after_trial',
    triggerUserMessage: 'Después de la prueba, cual es el costo?',
    notes: 'Admin ya respondió incompleto; Sofía envía precios Max/Pro + trial.',
  },
  {
    phone: '+525530741733',
    conversationId: '752aa4b4-bc0a-43ff-b1d7-be6fa5e447f2',
    kind: 'greeting_options',
    triggerUserMessage: 'Hola, me interesa conocer Kalyo para psicólogos 👋',
  },
  {
    phone: '+529331032403',
    conversationId: 'ef8dbb78-eeb0-4c32-be3f-e4ece5df2b30',
    kind: 'pricing',
    triggerUserMessage: 'Costo',
  },
  {
    phone: '+573112462566',
    conversationId: 'f1b3f01c-0df8-49d6-b98e-0e3d231f35cc',
    kind: 'activate_trial',
    triggerUserMessage: 'lpira@cllanos.co',
    trial: { fullName: 'Luz Dary Pira', email: 'lpira@cllanos.co' },
    notes: 'Nombre + email quedaron en fallback; activar trial Max via enroll.',
  },
  {
    phone: '+526643575061',
    conversationId: '82d029ab-8324-497b-8c66-8668d4d8cbd9',
    kind: 'skip',
    triggerUserMessage: 'santiagomoranteg@gmail.com',
    skipReason:
      'Ya recuperado: trial welcome + demo follow-up + slots ofrecidos (19:55–20:06 UTC).',
  },
];

type PlannedSend = {
  phone: string;
  conversationId: string;
  kind: CaseKind;
  bodies: string[];
  willActivateTrial: boolean;
  skip?: boolean;
  skipReason?: string;
  notes?: string;
};

function buildGreetingOptionsMessage(): string {
  return (
    `¡Hola! 👋 Qué gusto que me escribas.\n\n` +
    `Kalyo digitaliza tu práctica clínica: más de 200 tests psicométricos, ` +
    `reportes con IA, agenda y videollamadas — todo en un solo lugar.\n\n` +
    `¿En qué te ayudo?\n` +
    `1️⃣ Evaluaciones\n` +
    `2️⃣ Precios\n` +
    `3️⃣ Prueba gratis\n` +
    `4️⃣ Agendar demo`
  );
}

function buildPricingAfterTrialMessage(): string {
  return (
    `Después de la prueba, si te gusta puedes continuar con cualquiera de estos planes:\n\n` +
    buildStandardPricePresentation()
  );
}

function planCase(c: OrphanCase): PlannedSend {
  if (EXCLUDED.has(c.phone) || c.kind === 'skip') {
    return {
      phone: c.phone,
      conversationId: c.conversationId,
      kind: c.kind,
      bodies: [],
      willActivateTrial: false,
      skip: true,
      skipReason: c.skipReason ?? 'excluded',
      notes: c.notes,
    };
  }

  if (c.kind === 'pricing_after_trial') {
    return {
      phone: c.phone,
      conversationId: c.conversationId,
      kind: c.kind,
      bodies: [buildPricingAfterTrialMessage()],
      willActivateTrial: false,
      notes: c.notes,
    };
  }

  if (c.kind === 'greeting_options') {
    return {
      phone: c.phone,
      conversationId: c.conversationId,
      kind: c.kind,
      bodies: [buildGreetingOptionsMessage()],
      willActivateTrial: false,
    };
  }

  if (c.kind === 'pricing') {
    return {
      phone: c.phone,
      conversationId: c.conversationId,
      kind: c.kind,
      bodies: [buildStandardPricePresentation()],
      willActivateTrial: false,
    };
  }

  const preview = buildTrialActivationSuccessMessage({
    email: c.trial!.email,
    fullName: c.trial!.fullName,
    trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    trialPlan: 'max',
    tempPassword: '••••••••',
  });

  return {
    phone: c.phone,
    conversationId: c.conversationId,
    kind: c.kind,
    bodies: [
      `[activateTrialForLead → welcome credentials]\n${preview}`,
      `[activateTrialForLead → demo offer]\n${buildTrialDemoFollowUpOfferMessage()}`,
    ],
    willActivateTrial: true,
    notes: c.notes,
  };
}

function printPlan(planned: PlannedSend[]): void {
  console.log('\n========== DRY-RUN / PLAN ==========\n');
  console.log(`Mode: ${CONFIRM ? 'CONFIRM (will send)' : 'DRY-RUN (no send)'}`);
  console.log(`Excluded: ${[...EXCLUDED].join(', ')}`);
  console.log('');

  for (const p of planned) {
    console.log('─'.repeat(60));
    console.log(`${p.phone} | ${p.kind} | conv=${p.conversationId}`);
    if (p.notes) console.log(`  note: ${p.notes}`);
    if (p.skip) {
      console.log(`  SKIP: ${p.skipReason}`);
      continue;
    }
    if (p.willActivateTrial) {
      console.log('  action: activate Max trial (enroll welcome + demo offer)');
    }
    p.bodies.forEach((body, i) => {
      console.log(`\n  --- message ${i + 1}/${p.bodies.length} ---`);
      console.log(
        body
          .split('\n')
          .map((l) => `  ${l}`)
          .join('\n'),
      );
    });
    console.log('');
  }

  const toSend = planned.filter((p) => !p.skip);
  console.log('─'.repeat(60));
  console.log(
    `Resumen: ${toSend.length} conversaciones a retomar, ${planned.length - toSend.length} skip.`,
  );
  if (!CONFIRM) {
    console.log('\nRe-run with --confirm to send WhatsApp + persist messages.\n');
  }
}

async function executeConfirm(planned: PlannedSend[]): Promise<void> {
  // CJS require so server-only mock in require.cache applies
  const { activateTrialForLead } = require('../lib/activate-trial-lead.ts') as typeof import('../lib/activate-trial-lead');
  const { sendWhatsAppMessage } = require('../lib/twilio.ts') as typeof import('../lib/twilio');
  const { setTrialDemoOfferPending } = require('../lib/trial-welcome-demo.ts') as typeof import('../lib/trial-welcome-demo');
  const { getKalyoClient } = require('../lib/kalyo-supabase.ts') as typeof import('../lib/kalyo-supabase');
  const { formatTrialEndDateLabel } = require('../lib/trial-onboarding-messages.ts') as typeof import('../lib/trial-onboarding-messages');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const botId =
    process.env.KALYO_BOT_ID ?? '64f6eed2-1522-48fe-a2c6-f858b767df06';
  const { data: bot, error: botErr } = await supabase
    .from('bots')
    .select('twilio_account_sid, twilio_auth_token, twilio_whatsapp_number')
    .eq('id', botId)
    .maybeSingle();
  if (botErr || !bot?.twilio_account_sid || !bot.twilio_auth_token || !bot.twilio_whatsapp_number) {
    throw botErr ?? new Error('Bot Twilio credentials missing');
  }
  const creds = {
    accountSid: bot.twilio_account_sid as string,
    authToken: bot.twilio_auth_token as string,
    from: bot.twilio_whatsapp_number as string,
  };

  async function insertAssistant(
    conversationId: string,
    content: string,
    metadata: Record<string, unknown>,
  ) {
    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content,
      source: 'text',
      source_type: 'claude',
      metadata,
    });
    if (error) throw error;
  }

  async function sendAndPersist(
    phone: string,
    conversationId: string,
    body: string,
    metadata: Record<string, unknown>,
  ) {
    const sent = await sendWhatsAppMessage({
      ...creds,
      to: `whatsapp:${phone}`,
      body,
    });
    await insertAssistant(conversationId, body, {
      ...metadata,
      twilio_sid: sent.sid,
    });
    console.log(`[sent] ${phone} sid=${sent.sid} chars=${body.length}`);
    return sent.sid as string;
  }

  async function lookupActiveTrial(email: string): Promise<{
    email: string;
    full_name: string | null;
    trial_ends_at: string | null;
  } | null> {
    const kalyo = getKalyoClient();
    const { data, error } = await kalyo
      .from('psychologists')
      .select('email, full_name, trial_ends_at, plan_expires_at')
      .eq('email', email.toLowerCase())
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const now = Date.now();
    const trialEnds = data.trial_ends_at
      ? new Date(data.trial_ends_at as string).getTime()
      : 0;
    const planExpires = data.plan_expires_at
      ? new Date(data.plan_expires_at as string).getTime()
      : 0;
    if (trialEnds <= now && planExpires <= now) return null;
    return {
      email: data.email as string,
      full_name: (data.full_name as string | null) ?? null,
      trial_ends_at: (data.trial_ends_at as string | null) ?? null,
    };
  }

  for (const c of CASES) {
    if (EXCLUDED.has(c.phone)) {
      console.log(`[excluded] ${c.phone}`);
      continue;
    }
    const p = planned.find((x) => x.phone === c.phone)!;
    if (p.skip) {
      console.log(`[skip] ${c.phone} — ${p.skipReason}`);
      continue;
    }

    try {
      if (c.kind === 'activate_trial' && c.trial) {
        console.log(`[trial] pre-check ${c.trial.email}…`);
        const existing = await lookupActiveTrial(c.trial.email);
        if (existing) {
          const ends = existing.trial_ends_at
            ? formatTrialEndDateLabel(existing.trial_ends_at)
            : 'próximamente';
          const name = existing.full_name?.trim() || c.trial.fullName;
          const soft =
            `¡Hola ${name}! 👋 Aquí continúo — tu prueba gratis de Max ya está activa` +
            (existing.trial_ends_at ? ` (vence ${ends})` : '') +
            `.\n\n` +
            `🔐 Acceso:\n` +
            `🌐 https://app.kalyo.io/login\n` +
            `📧 ${existing.email}\n` +
            `Si no tienes la contraseña a la mano, usa "Olvidé mi contraseña" en el login.\n\n` +
            `¿Te gustaría agendar una demo de 20 minutos con nuestro equipo?\n` +
            `1️⃣ Sí, quiero una demo\n` +
            `2️⃣ No por ahora, exploraré solo`;
          await sendAndPersist(c.phone, c.conversationId, soft, {
            source: 'resume_orphan_anthropic_credits',
            resume_orphan: true,
            resumed_trigger: c.triggerUserMessage,
            trial_already_active: true,
          });
          await setTrialDemoOfferPending(supabase, c.conversationId, true);
          console.log(`[trial] already active — soft resume sent (no reactivate)`);
          continue;
        }

        console.log(`[trial] activating ${c.trial.email} for ${c.phone}…`);
        const result = await activateTrialForLead({
          email: c.trial.email,
          fullName: c.trial.fullName,
          phone: c.phone,
          source: 'resume_orphan_anthropic_credits',
          trialPlan: 'max',
        });
        if (result.status !== 'success') {
          throw new Error(`${result.error} ${result.detail ?? ''}`);
        }
        console.log(
          `[trial] ok email=${result.email} welcome_sent=${result.welcome_sent} reactivated=${result.reactivated}`,
        );
        if (result.welcome_sent) {
          console.log(`[trial] no extra WA — enroll already messaged ${c.phone}`);
          continue;
        }
        const successMsg = buildTrialActivationSuccessMessage({
          email: result.email,
          fullName: c.trial.fullName,
          trialEndsAt: result.trial_ends_at,
          trialPlan: 'max',
          reactivated: result.reactivated,
          tempPassword: result.temp_password,
        });
        const demoOffer = buildTrialDemoFollowUpOfferMessage();
        for (const [i, body] of [successMsg, demoOffer].entries()) {
          await sendAndPersist(c.phone, c.conversationId, body, {
            source:
              i === 1 ? 'trial_demo_followup_offer' : 'resume_orphan_anthropic_credits',
            resume_orphan: true,
            resumed_trigger: c.triggerUserMessage,
          });
          if (i === 1) await setTrialDemoOfferPending(supabase, c.conversationId, true);
        }
        continue;
      }

      const { data: last } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', c.conversationId)
        .order('created_at', { ascending: false })
        .limit(5);
      const hasFallback = (last ?? []).some(
        (m) =>
          m.role === 'assistant' &&
          typeof m.content === 'string' &&
          m.content.includes(FALLBACK_SNIPPET),
      );
      if (!hasFallback && c.kind !== 'pricing_after_trial') {
        console.warn(`[warn] ${c.phone}: no recent fallback — sending anyway`);
      }

      for (const body of p.bodies) {
        await sendAndPersist(c.phone, c.conversationId, body, {
          source: 'resume_orphan_anthropic_credits',
          resume_orphan: true,
          resumed_trigger: c.triggerUserMessage,
        });
      }
    } catch (error) {
      console.error(`[error] ${c.phone}`, error);
    }
  }

  console.log('\nDone.');
}

async function main(): Promise<void> {
  const planned = CASES.filter((c) => !EXCLUDED.has(c.phone)).map(planCase);
  printPlan(planned);
  if (!CONFIRM) return;
  await executeConfirm(planned);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
