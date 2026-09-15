/**
 * QA end-to-end — flujo demo WhatsApp 1/2/3 (Google Calendar slots).
 *
 *   npx tsx scripts/test-demo-slots-flow.ts
 *   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/test-demo-slots-flow.ts
 *   npx tsx scripts/test-demo-slots-flow.ts --skip-cleanup
 *
 * No envía WhatsApp real. Crea conversación temporal + evento Calendar + scheduled_demos.
 */
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

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

const SKIP_CLEANUP = process.argv.includes('--skip-cleanup');
const QA_EMAIL = 'qa-demo@kalyo-test.com';
const QA_NAME = 'QA Demo Slots';
const DEFAULT_BOT_ID = '64f6eed2-1522-48fe-a2c6-f858b767df06';

function fail(step: string, error: unknown): never {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`❌ ${step}: ${msg}`);
  throw error instanceof Error ? error : new Error(`${step}: ${msg}`);
}

function assert(condition: boolean, step: string, detail: string): void {
  if (!condition) fail(step, detail);
}

async function main(): Promise<void> {
  const results = {
    oauth: false,
    slots: false,
    format: false,
    pending: false,
    selection: false,
    calendarEvent: false,
    scheduledRow: false,
    cleanup: false,
  };

  const { createAdminClient } = await import('../lib/supabase/admin');
  const {
    getCalendarClient,
    getAvailableSlots,
    formatSlotsForBot,
    cancelDemoEvent,
    deleteDemoCalendarEvent,
    DEMO_HOST_EMAIL,
  } = await import('../lib/google-calendar');
  const { savePendingDemoSlots, clearPendingDemoSlots, loadPendingDemoSlots } =
    await import('../lib/demo-conversation');
  const { handleDemoConfirmInterception } = await import('../lib/demo-flow-interceptor');

  const supabase = createAdminClient();
  const botId = process.env.KALYO_BOT_ID?.trim() || DEFAULT_BOT_ID;
  const ts = Date.now();
  const qaPhone = `+5299902${String(ts).slice(-5)}`;

  let conversationId: string | null = null;
  let demoId: string | null = null;
  let googleEventId: string | null = null;

  try {
    // ─── PASO 1 — OAuth ───────────────────────────────────────────────────────
    console.log('\n=== PASO 1 — OAuth Google Calendar ===');
    try {
      const client = await getCalendarClient();
      const cal = await client.calendarList.get({ calendarId: 'primary' });
      assert(Boolean(cal.data.id), 'PASO 1', 'calendarList.get no retornó id');
      console.log(`   Host: ${DEMO_HOST_EMAIL} | calendar: ${cal.data.summary ?? cal.data.id}`);
      console.log('✅ OAuth OK — token válido');
      results.oauth = true;
    } catch (err) {
      fail('PASO 1 OAuth', err);
    }

    // ─── PASO 2 — Slots ───────────────────────────────────────────────────────
    console.log('\n=== PASO 2 — Consultar slots disponibles ===');
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000);
    let slots: Awaited<ReturnType<typeof getAvailableSlots>>['slots'] = [];
    try {
      const result = await getAvailableSlots({
        startDate,
        endDate,
        durationMinutes: 30,
        customerPhone: qaPhone,
        customerTimezone: 'America/Mexico_City',
        customerLabel: 'CDMX',
      });
      slots = result.slots;
      assert(slots.length >= 1, 'PASO 2', `Se esperaba ≥1 slot, got ${slots.length}`);
      slots.slice(0, 3).forEach((slot, i) => {
        console.log(`   ${i + 1}. ${slot.label_es} (${slot.start} → ${slot.end})`);
      });
      console.log(`✅ Slots disponibles: ${slots.length} encontrados`);
      results.slots = true;
    } catch (err) {
      fail('PASO 2 slots', err);
    }

    // ─── PASO 3 — Formato WhatsApp ────────────────────────────────────────────
    console.log('\n=== PASO 3 — Formatear mensaje para WhatsApp ===');
    try {
      const message = formatSlotsForBot(slots);
      console.log('--- mensaje ---\n' + message + '\n---------------');
      // formatSlotsForBot usa "1️⃣" / "Responde con 1, 2 o 3" (no "1.")
      const hasNumbered =
        /1⃣|1️⃣/.test(message) ||
        /Responde con 1,\s*2\s*o\s*3/i.test(message) ||
        (/\b1[.)]\s/.test(message) && /\b2[.)]\s/.test(message));
      assert(hasNumbered, 'PASO 3', 'El mensaje no incluye opciones numeradas 1/2/3');
      if (slots.length >= 2) {
        assert(/2⃣|2️⃣|\b2[.)]\s|,\s*2\s/.test(message), 'PASO 3', 'Falta opción 2');
      }
      if (slots.length >= 3) {
        assert(/3⃣|3️⃣|\b3[.)]\s|o\s*3/.test(message), 'PASO 3', 'Falta opción 3');
      }
      console.log('✅ Formato correcto');
      results.format = true;
    } catch (err) {
      fail('PASO 3 formato', err);
    }

    // ─── PASO 4 — Pending slots ───────────────────────────────────────────────
    console.log('\n=== PASO 4 — Guardar pending slots ===');
    try {
      const { data: conv, error: convError } = await supabase
        .from('conversations')
        .insert({
          bot_id: botId,
          customer_phone: qaPhone,
          channel: 'whatsapp',
          metadata: {
            qa_demo_slots_flow: true,
            customer_name: QA_NAME,
            customer_email: QA_EMAIL,
          },
        })
        .select('id')
        .single();

      if (convError || !conv?.id) {
        throw convError ?? new Error('No se pudo crear conversación de prueba');
      }
      conversationId = conv.id as string;

      await savePendingDemoSlots(supabase, conversationId, {
        slots,
        customer_email: QA_EMAIL,
        customer_name: QA_NAME,
        customer_phone: qaPhone,
        customer_timezone: 'America/Mexico_City',
        customer_city_label: 'CDMX',
        display_timezone: 'America/Mexico_City',
        display_label: 'CDMX',
        offered_at: new Date().toISOString(),
      });

      const loaded = await loadPendingDemoSlots(supabase, conversationId);
      assert(Boolean(loaded?.slots?.length), 'PASO 4', 'pending_demo_slots vacío tras guardar');
      assert(
        loaded!.slots[0].start === slots[0].start,
        'PASO 4',
        'El primer slot guardado no coincide',
      );
      console.log(`   conversation_id=${conversationId}`);
      console.log('✅ Pending slots guardados en metadata');
      results.pending = true;
    } catch (err) {
      fail('PASO 4 pending', err);
    }

    // ─── PASO 5 — Selección "1" ───────────────────────────────────────────────
    console.log('\n=== PASO 5 — Simular selección del usuario ("1") ===');
    try {
      const pending = await loadPendingDemoSlots(supabase, conversationId!);
      assert(Boolean(pending), 'PASO 5', 'No hay pending para confirmar');

      const intercept = await handleDemoConfirmInterception({
        supabase,
        conversationId: conversationId!,
        messageBody: '1',
        senderFrom: qaPhone,
        botId,
        creds: null, // no WhatsApp / notify Twilio
        pending: pending!,
      });

      console.log('--- reply ---\n' + intercept.replyText + '\n-------------');
      assert(
        intercept.source === 'auto_demo_confirm',
        'PASO 5',
        `source inesperado: ${intercept.source}`,
      );
      assert(
        intercept.toolResult.status === 'success',
        'PASO 5',
        `status=${intercept.toolResult.status} | ${intercept.toolResult.bot_message}`,
      );
      assert(
        /demo agendada|agendada/i.test(intercept.replyText),
        'PASO 5',
        'Reply no parece confirmación de demo',
      );

      demoId =
        typeof intercept.toolResult.demo_id === 'string'
          ? intercept.toolResult.demo_id
          : null;
      assert(Boolean(demoId), 'PASO 5', 'toolResult sin demo_id');

      console.log('✅ Selección "1" procesada correctamente');
      results.selection = true;
    } catch (err) {
      fail('PASO 5 selección', err);
    }

    // ─── PASO 6 — Evento Google Calendar ─────────────────────────────────────
    console.log('\n=== PASO 6 — Verificar evento en Google Calendar ===');
    try {
      const { data: demoRow, error: demoError } = await supabase
        .from('scheduled_demos')
        .select('id, google_event_id, google_meet_link, scheduled_at, duration_minutes, status')
        .eq('id', demoId!)
        .maybeSingle();

      if (demoError) throw demoError;
      assert(Boolean(demoRow?.google_event_id), 'PASO 6', 'scheduled_demos sin google_event_id');
      googleEventId = demoRow!.google_event_id as string;

      const calendar = await getCalendarClient();
      const event = await calendar.events.get({
        calendarId: 'primary',
        eventId: googleEventId,
      });

      const startIso = event.data.start?.dateTime;
      const endIso = event.data.end?.dateTime;
      assert(Boolean(startIso && endIso), 'PASO 6', 'Evento sin start/end dateTime');

      const durationMin =
        (new Date(endIso!).getTime() - new Date(startIso!).getTime()) / 60_000;
      assert(
        Math.abs(durationMin - 30) < 0.5,
        'PASO 6',
        `Duración esperada 30 min, got ${durationMin}`,
      );

      const meetLink =
        event.data.hangoutLink ??
        event.data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')
          ?.uri ??
        demoRow!.google_meet_link ??
        null;
      assert(Boolean(meetLink), 'PASO 6', 'Evento sin Google Meet link');

      console.log(
        `✅ Evento creado: ${event.data.summary ?? '(sin título)'} | ${startIso} | Meet: ${meetLink}`,
      );
      results.calendarEvent = true;
    } catch (err) {
      fail('PASO 6 Calendar', err);
    }

    // ─── PASO 7 — scheduled_demos ─────────────────────────────────────────────
    console.log('\n=== PASO 7 — Verificar fila en scheduled_demos ===');
    try {
      const { data: rows, error } = await supabase
        .from('scheduled_demos')
        .select('*')
        .eq('conversation_id', conversationId!);

      if (error) throw error;
      assert((rows?.length ?? 0) >= 1, 'PASO 7', 'No hay filas en scheduled_demos');
      const row = rows!.find((r) => r.id === demoId) ?? rows![0];
      assert(
        row.status === 'scheduled' || row.status === 'confirmed',
        'PASO 7',
        `status inesperado: ${row.status}`,
      );
      assert(Boolean(row.google_meet_link || row.google_event_id), 'PASO 7', 'Sin meet/event id');
      assert(
        Number(row.duration_minutes) === 30,
        'PASO 7',
        `duration_minutes=${row.duration_minutes}, esperado 30`,
      );
      console.log(
        `   id=${row.id} | status=${row.status} | duration=${row.duration_minutes} | meet=${row.google_meet_link ?? '—'}`,
      );
      console.log('✅ scheduled_demos row creado');
      results.scheduledRow = true;
    } catch (err) {
      fail('PASO 7 scheduled_demos', err);
    }

    // ─── PASO 8 — Limpieza ────────────────────────────────────────────────────
    console.log('\n=== PASO 8 — Limpieza ===');
    if (SKIP_CLEANUP) {
      console.log('⚠️  --skip-cleanup: dejando conversación, demo y evento');
      console.log(`   conversation_id=${conversationId}`);
      console.log(`   demo_id=${demoId}`);
      console.log(`   google_event_id=${googleEventId}`);
      results.cleanup = true;
    } else {
      try {
        if (demoId) {
          try {
            await cancelDemoEvent(demoId, 'qa-demo-slots-flow cleanup');
          } catch (err) {
            console.warn('   cancelDemoEvent warning:', err instanceof Error ? err.message : err);
            if (googleEventId) {
              await deleteDemoCalendarEvent(googleEventId).catch(() => undefined);
            }
          }
        } else if (googleEventId) {
          await deleteDemoCalendarEvent(googleEventId);
        }

        if (conversationId) {
          await supabase.from('scheduled_demos').delete().eq('conversation_id', conversationId);
          await clearPendingDemoSlots(supabase, conversationId);
          await supabase.from('messages').delete().eq('conversation_id', conversationId);
          await supabase.from('conversations').delete().eq('id', conversationId);
        }

        console.log('✅ Limpieza completa');
        results.cleanup = true;
      } catch (err) {
        fail('PASO 8 limpieza', err);
      }
    }
  } catch (err) {
    // Best-effort cleanup on failure (unless skip)
    if (!SKIP_CLEANUP && conversationId) {
      console.log('\n⚠️  Intentando limpieza tras fallo...');
      try {
        if (demoId) {
          await cancelDemoEvent(demoId, 'qa-demo-slots-flow failed cleanup').catch(() => undefined);
        } else if (googleEventId) {
          await deleteDemoCalendarEvent(googleEventId).catch(() => undefined);
        }
        await supabase.from('scheduled_demos').delete().eq('conversation_id', conversationId);
        await clearPendingDemoSlots(supabase, conversationId).catch(() => undefined);
        await supabase.from('messages').delete().eq('conversation_id', conversationId);
        await supabase.from('conversations').delete().eq('id', conversationId);
      } catch {
        /* ignore */
      }
    }
    throw err;
  }

  console.log(`
=============================
RESUMEN QA DEMO SLOTS
=============================
${results.oauth ? '✅' : '❌'} OAuth Google Calendar OK
${results.slots ? '✅' : '❌'} Slots disponibles encontrados
${results.format ? '✅' : '❌'} Formato WhatsApp correcto
${results.pending ? '✅' : '❌'} Pending slots guardados
${results.selection ? '✅' : '❌'} Selección usuario procesada
${results.calendarEvent ? '✅' : '❌'} Evento Google Calendar creado (30 min + Meet)
${results.scheduledRow ? '✅' : '❌'} scheduled_demos row creado
${SKIP_CLEANUP ? '⚠️  Limpieza omitida (--skip-cleanup)' : results.cleanup ? '✅ Limpieza completa' : '❌ Limpieza completa'}
=============================
FLUJO DEMO 1/2/3 LISTO ✅
`);
}

main().catch((err) => {
  console.error('\n❌ QA demo slots flow failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
