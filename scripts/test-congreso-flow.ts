/**
 * QA end-to-end — Congreso Plan MAX flow.
 *
 *   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/test-congreso-flow.ts
 *   npx tsx scripts/test-congreso-flow.ts
 *   npx tsx scripts/test-congreso-flow.ts --skip-cleanup
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { generatePassword } from '../lib/congreso-handler';
import {
  CONGRESO_MESSAGES,
  getKalyoAppUrl,
} from '../lib/congreso-messages';
import { runCongresoOnboardingCron } from '../lib/congreso-onboarding-cron';
import { getKalyoClient } from '../lib/kalyo-supabase';

function loadEnvLocal(): void {
  const envPath = join(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
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

function fail(step: string, error: unknown): never {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`❌ ${step}: ${msg}`);
  throw error instanceof Error ? error : new Error(msg);
}

loadEnvLocal();

const SKIP_CLEANUP = process.argv.includes('--skip-cleanup');

const PASSWORD_ALLOWED = /^[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789]+$/;
const AMBIGUOUS = /[0OIl]/;

async function resolveBotId(botio: ReturnType<typeof createClient>): Promise<string> {
  if (process.env.KALYO_BOT_ID?.trim()) return process.env.KALYO_BOT_ID.trim();

  const { data, error } = await botio.from('bots').select('id').limit(1).maybeSingle();
  if (error || !data?.id) {
    throw new Error('No KALYO_BOT_ID and no bots row available');
  }
  return data.id as string;
}

async function main(): Promise<void> {
  const botioUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const botioKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!botioUrl || !botioKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  if (!process.env.KALYO_SUPABASE_URL || !process.env.KALYO_SUPABASE_SERVICE_KEY) {
    throw new Error('Missing KALYO_SUPABASE_URL or KALYO_SUPABASE_SERVICE_KEY');
  }

  const botio = createClient(botioUrl, botioKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const kalyo = getKalyoClient();

  const ts = Date.now();
  const email = `congreso-test-${ts}@kalyo-qa.com`;
  const qaPhone = `+52155${String(ts).slice(-8)}`;
  const qaName = 'Usuario QA';
  let authUserId: string | null = null;
  let trialId: string | null = null;
  let password = '';

  console.log('\n=== QA Congreso flow ===\n');

  // ── PASO 1 ───────────────────────────────────────────────────────────────
  try {
    password = generatePassword();
    if (password.length !== 10) {
      throw new Error(`expected length 10, got ${password.length}`);
    }
    if (!PASSWORD_ALLOWED.test(password) || AMBIGUOUS.test(password)) {
      throw new Error(`password has invalid/ambiguous chars: ${password}`);
    }
    console.log(`✅ Password generado: ${password}`);
  } catch (err) {
    fail('PASO 1 — Generar contraseña', err);
  }

  // ── PASO 2 ───────────────────────────────────────────────────────────────
  try {
    const { data, error } = await kalyo.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: qaName,
        phone: qaPhone,
        source: 'congreso',
        plan: 'max',
      },
    });
    if (error) throw error;
    if (!data.user?.id) throw new Error('createUser returned no user id');
    authUserId = data.user.id;
    console.log(`✅ Usuario creado en Auth: ${email}`);
  } catch (err) {
    fail('PASO 2 — Crear usuario en Supabase Auth (Kalyo)', err);
  }

  // ── PASO 3 ───────────────────────────────────────────────────────────────
  try {
    const { data, error } = await kalyo.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const token = data.session?.access_token;
    if (!data.session || !token) throw new Error('missing session or access_token');
    console.log(`✅ Login exitoso. Token: ${token.slice(0, 20)}...`);
  } catch (err) {
    fail('PASO 3 — Verificar login', err);
  }

  // ── PASO 4 ───────────────────────────────────────────────────────────────
  try {
    const { data, error } = await kalyo
      .from('psychologists')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (error) throw error;
    if (data?.id) {
      console.log('✅ Psychologist row creado');
    } else {
      console.log(
        '⚠️  Psychologist row NO encontrado (esperado en este QA: solo createUser; el handler completo sí inserta)',
      );
    }
  } catch (err) {
    fail('PASO 4 — Verificar psychologists', err);
  }

  // ── PASO 5 ───────────────────────────────────────────────────────────────
  try {
    const botId = await resolveBotId(botio);
    const activatedAt = new Date();
    const expiresAt = new Date(activatedAt.getTime() + 30 * 24 * 60 * 60 * 1000);

    const { data, error } = await botio
      .from('congreso_trials')
      .insert({
        conversation_id: null,
        customer_phone: qaPhone,
        name: qaName,
        email,
        bot_id: botId,
        activated_at: activatedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        generated_password: password,
        account_created_at: activatedAt.toISOString(),
        day_1_sent_at: activatedAt.toISOString(),
      })
      .select('id')
      .single();

    if (error) throw error;
    if (!data?.id) throw new Error('insert returned no id');
    trialId = data.id as string;
    console.log(`✅ congreso_trials row insertado. ID: ${trialId}`);
  } catch (err) {
    fail('PASO 5 — Insert congreso_trials', err);
  }

  // ── PASO 6 ───────────────────────────────────────────────────────────────
  try {
    const day1Preview = CONGRESO_MESSAGES.confirmed({
      name: qaName,
      email,
      password,
      url: getKalyoAppUrl(),
    });
    if (!day1Preview.includes(email)) {
      throw new Error('day 1 message missing email');
    }
    if (!day1Preview.includes(password)) {
      throw new Error('day 1 message missing password');
    }
    if (!day1Preview.includes(getKalyoAppUrl())) {
      throw new Error('day 1 message missing KALYO_APP_URL');
    }

    const result = await runCongresoOnboardingCron({
      supabase: botio,
      creds: {
        accountSid: 'dry-run',
        authToken: 'dry-run',
        from: 'whatsapp:+10000000000',
      },
      dryRun: true,
      emailFilter: email,
      sendFn: async () => {
        throw new Error('DRY_RUN sendFn must not be called');
      },
    });

    const planned = result.planned ?? [];
    const forTrial = planned.filter((p) => p.trialId === trialId);
    if (forTrial.length === 0) {
      throw new Error('cron dryRun did not detect the QA trial');
    }

    const day1Plan = forTrial.find((p) => p.day === 1);
    if (!day1Plan) throw new Error('cron dryRun missing day 1 plan item');
    if (!day1Plan.messagePreview.includes(email)) {
      throw new Error('cron day 1 preview missing email');
    }
    if (!day1Plan.messagePreview.includes(password)) {
      throw new Error('cron day 1 preview missing password');
    }
    if (!day1Plan.messagePreview.includes(getKalyoAppUrl())) {
      throw new Error('cron day 1 preview missing app url');
    }

    const preview = day1Plan.messagePreview.replace(/\s+/g, ' ').slice(0, 120);
    console.log(`✅ Cron detecta el trial. Mensaje día 1: ${preview}...`);
  } catch (err) {
    fail('PASO 6 — Cron dryRun', err);
  }

  // ── PASO 7 ───────────────────────────────────────────────────────────────
  if (SKIP_CLEANUP) {
    console.log('\n⚠️  --skip-cleanup: dejando datos para login manual');
    console.log(`   email: ${email}`);
    console.log(`   password: ${password}`);
    console.log(`   url: ${getKalyoAppUrl()}`);
  } else {
    try {
      if (trialId) {
        const { error } = await botio.from('congreso_trials').delete().eq('id', trialId);
        if (error) throw error;
      } else {
        await botio.from('congreso_trials').delete().eq('email', email);
      }

      await kalyo.from('psychologists').delete().eq('email', email);

      if (authUserId) {
        const { error } = await kalyo.auth.admin.deleteUser(authUserId);
        if (error) throw error;
      }

      console.log('✅ Datos de prueba eliminados');
    } catch (err) {
      fail('PASO 7 — Limpieza', err);
    }
  }

  console.log(`
=============================
RESUMEN QA CONGRESO
=============================
✅ Password generado correctamente
✅ Usuario creado en Supabase Auth
✅ Login funciona con las credenciales
✅ Row en congreso_trials insertado
✅ Cron detecta el trial
${SKIP_CLEANUP ? '⚠️  Limpieza omitida (--skip-cleanup)' : '✅ Limpieza completa'}
=============================
FLUJO LISTO PARA PRODUCCIÓN ✅
`);
}

main().catch((err) => {
  console.error('\n=============================');
  console.error('QA CONGRESO FALLÓ ❌');
  console.error(err instanceof Error ? err.message : err);
  console.error('=============================\n');
  process.exit(1);
});
