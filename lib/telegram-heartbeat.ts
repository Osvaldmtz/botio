import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { testClaude, testDB, testTelegram, testTwilio } from '@/lib/health-checks';
import { formatLastMessageLabel, getTrafficHealthStats } from '@/lib/traffic-health';
import { getMexicoTimeContext } from '@/lib/traffic-monitor';

export type TelegramHeartbeatResult = {
  message: string;
  health: {
    database: boolean;
    twilio: boolean;
    claude: boolean;
    telegram: boolean;
  };
  traffic_status: string;
  user_messages_last_24h: number;
};

export async function buildTelegramHeartbeat(
  supabase: SupabaseClient,
): Promise<TelegramHeartbeatResult> {
  const [checks, traffic] = await Promise.all([
    Promise.all([testDB(), testTwilio(), testClaude(), testTelegram()]).then(
      ([database, twilio, claude, telegram]) => ({ database, twilio, claude, telegram }),
    ),
    getTrafficHealthStats(supabase),
  ]);

  const ctx = getMexicoTimeContext();
  const checkLine = (ok: boolean, label: string) => `${ok ? '✅' : '❌'} ${label}`;
  const allOk = Object.values(checks).every(Boolean);

  const message = [
    `💚 Botio heartbeat diario`,
    ``,
    `Hora MX: ${ctx.hourMx}:00 (${ctx.isWeekday ? 'laboral' : 'fin de semana'})`,
    `Estado tráfico: ${traffic.status_emoji} ${traffic.status_label}`,
    `Último msg user: ${formatLastMessageLabel(traffic)}`,
    `Msgs últimas 24h: ${traffic.messages_last_24h}`,
    ``,
    `Health checks:`,
    checkLine(checks.database, 'Database'),
    checkLine(checks.twilio, 'Twilio'),
    checkLine(checks.claude, 'Claude API key'),
    checkLine(checks.telegram, 'Telegram bot'),
    ``,
    allOk ? 'Sistema operativo ✅' : '⚠️ Revisar checks fallidos',
  ].join('\n');

  return {
    message,
    health: checks,
    traffic_status: traffic.status_label,
    user_messages_last_24h: traffic.messages_last_24h,
  };
}
