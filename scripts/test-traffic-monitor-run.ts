/**
 * Unit tests for traffic monitor alert logic (no DB / Telegram required).
 */
import {
  buildCriticalAlertMessage,
  buildLowTrafficAlertMessage,
  evaluateTrafficAlert,
  getMexicoTimeContext,
  runTrafficMonitor,
} from '../lib/traffic-monitor';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const telegramSent: string[] = [];

async function mockSendAlert(text: string) {
  telegramSent.push(text);
  return { sent: true };
}

function mondayAtHourMx(hour: number): Date {
  // 2025-06-16 is Monday; 15:00 UTC = 09:00 MX (CDMX, UTC-6)
  return new Date(Date.UTC(2025, 5, 16, hour + 6, 0, 0));
}

function saturdayAtHourMx(hour: number): Date {
  // 2025-06-21 is Saturday
  return new Date(Date.UTC(2025, 5, 21, hour + 6, 0, 0));
}

function sundayEarlyMx(): Date {
  // Sunday 2025-06-22 03:00 MX = 09:00 UTC
  return new Date(Date.UTC(2025, 5, 22, 9, 0, 0));
}

async function main() {
  console.log('[test] traffic monitor alert logic\n');

  // --- evaluateTrafficAlert ---

  const activeWeekday = getMexicoTimeContext(mondayAtHourMx(11));
  assert(activeWeekday.isWeekday && activeWeekday.isActiveHours, 'Monday 11 AM MX is active weekday');

  assert(evaluateTrafficAlert(0, activeWeekday).kind === 'critical', '0 msgs → critical');
  assert(evaluateTrafficAlert(2, activeWeekday).kind === 'low', '2 msgs → low');
  assert(evaluateTrafficAlert(5, activeWeekday).kind === 'none', '5 msgs → none');

  const weekend = getMexicoTimeContext(saturdayAtHourMx(12));
  assert(!weekend.isWeekday, 'Saturday is not weekday');
  assert(evaluateTrafficAlert(0, weekend).kind === 'none', 'weekend 0 msgs → no alert');

  const earlyMorning = getMexicoTimeContext(sundayEarlyMx());
  assert(!earlyMorning.isActiveHours, 'Sunday 3 AM MX is outside active hours');
  assert(evaluateTrafficAlert(0, earlyMorning).kind === 'none', 'madrugada 0 msgs → no alert');

  // --- message builders ---

  assert(
    buildCriticalAlertMessage(activeWeekday).includes('ALERTA CRÍTICA'),
    'critical message has header',
  );
  assert(
    buildLowTrafficAlertMessage(2).includes('Solo 2 mensajes'),
    'low traffic message includes count',
  );

  // --- runTrafficMonitor with mock supabase ---

  telegramSent.length = 0;

  const mockSupabaseZero = {
    from(table: string) {
      if (table === 'messages') {
        return {
          select: () => ({
            eq: () => ({
              gte: async () => ({ count: 0, error: null }),
            }),
          }),
        };
      }
      if (table === 'meta_cache') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null }),
            }),
          }),
          upsert: async () => ({ error: null }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };

  const criticalResult = await runTrafficMonitor(
    mockSupabaseZero as never,
    mockSendAlert,
    mondayAtHourMx(11),
  );
  assert(criticalResult.alert_sent, '0 msgs active weekday → alert sent');
  assert(telegramSent.length === 1, 'exactly one telegram on critical');
  assert(telegramSent[0].includes('ALERTA CRÍTICA'), 'critical telegram content');

  telegramSent.length = 0;
  const weekendResult = await runTrafficMonitor(
    mockSupabaseZero as never,
    mockSendAlert,
    saturdayAtHourMx(12),
  );
  assert(!weekendResult.alert_sent, 'weekend → no alert');
  assert(telegramSent.length === 0, 'no telegram on weekend');

  telegramSent.length = 0;
  const nightResult = await runTrafficMonitor(
    mockSupabaseZero as never,
    mockSendAlert,
    sundayEarlyMx(),
  );
  assert(!nightResult.alert_sent, 'madrugada → no alert');

  telegramSent.length = 0;
  const mockSupabaseLow = {
    from(table: string) {
      if (table === 'messages') {
        return {
          select: () => ({
            eq: () => ({
              gte: async () => ({ count: 2, error: null }),
            }),
          }),
        };
      }
      if (table === 'meta_cache') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null }),
            }),
          }),
          upsert: async () => ({ error: null }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };

  const lowResult = await runTrafficMonitor(
    mockSupabaseLow as never,
    mockSendAlert,
    mondayAtHourMx(14),
  );
  assert(lowResult.alert_kind === 'low', '2 msgs → low kind');
  assert(lowResult.alert_sent, 'low traffic alert sent');
  assert(telegramSent[0].includes('Tráfico bajo'), 'yellow alert text');

  console.log('\n[test] all traffic monitor scenarios passed ✓');
}

main().catch((err) => {
  console.error('[test] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
