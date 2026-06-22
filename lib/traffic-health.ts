import { startOfDay } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  countUserMessagesLast2h,
  evaluateTrafficAlert,
  getMexicoTimeContext,
} from '@/lib/traffic-monitor';

const MX_TZ = 'America/Mexico_City';

export type TrafficHealthStatus = 'ok' | 'slow' | 'down';

export type TrafficHealthStats = {
  last_user_message_at: string | null;
  minutes_since_last_user_message: number | null;
  messages_last_24h: number;
  avg_messages_per_hour_24h: number;
  peak_hour_today: string | null;
  peak_hour_count_today: number;
  user_messages_last_2h: number | null;
  status: TrafficHealthStatus;
  status_label: string;
  status_emoji: string;
};

function formatMinutesAgo(minutes: number): string {
  if (minutes < 1) return 'hace menos de 1 min';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `hace ${hours}h`;
  return `hace ${hours}h ${mins}min`;
}

function resolveStatus(
  userMessagesLast2h: number | null,
  minutesSinceLast: number | null,
): { status: TrafficHealthStatus; label: string; emoji: string } {
  const ctx = getMexicoTimeContext();
  const decision = evaluateTrafficAlert(userMessagesLast2h, ctx);

  if (decision.kind === 'critical') {
    return { status: 'down', label: 'CAÍDO', emoji: '🔴' };
  }
  if (decision.kind === 'low') {
    return { status: 'slow', label: 'LENTO', emoji: '🟡' };
  }

  if (minutesSinceLast !== null && minutesSinceLast >= 120 && ctx.isActiveHours && ctx.isWeekday) {
    return { status: 'down', label: 'CAÍDO', emoji: '🔴' };
  }
  if (minutesSinceLast !== null && minutesSinceLast >= 60 && ctx.isActiveHours && ctx.isWeekday) {
    return { status: 'slow', label: 'LENTO', emoji: '🟡' };
  }

  return { status: 'ok', label: 'OK', emoji: '🟢' };
}

export async function getTrafficHealthStats(
  supabase: SupabaseClient,
): Promise<TrafficHealthStats> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [lastMsgRes, count24hRes, userMessagesLast2h] = await Promise.all([
    supabase
      .from('messages')
      .select('created_at')
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'user')
      .gte('created_at', since24h.toISOString()),
    countUserMessagesLast2h(supabase),
  ]);

  const lastAt = lastMsgRes.data?.created_at ?? null;
  const minutesSinceLast = lastAt
    ? Math.floor((Date.now() - new Date(lastAt).getTime()) / 60_000)
    : null;

  const messagesLast24h = count24hRes.count ?? 0;
  const avgMessagesPerHour = Math.round((messagesLast24h / 24) * 10) / 10;

  const nowMx = toZonedTime(new Date(), MX_TZ);
  const dayStartUtc = fromZonedTime(startOfDay(nowMx), MX_TZ);

  const { data: todayMsgs } = await supabase
    .from('messages')
    .select('created_at')
    .eq('role', 'user')
    .gte('created_at', dayStartUtc.toISOString());

  const hourBuckets = new Map<number, number>();
  for (const row of todayMsgs ?? []) {
    const hour = toZonedTime(new Date(row.created_at), MX_TZ).getHours();
    hourBuckets.set(hour, (hourBuckets.get(hour) ?? 0) + 1);
  }

  let peakHour: number | null = null;
  let peakCount = 0;
  for (const [hour, count] of Array.from(hourBuckets.entries())) {
    if (count > peakCount) {
      peakCount = count;
      peakHour = hour;
    }
  }

  const peakHourLabel =
    peakHour !== null
      ? `${peakHour === 0 ? 12 : peakHour > 12 ? peakHour - 12 : peakHour} ${peakHour < 12 ? 'AM' : 'PM'}`
      : null;

  const { status, label, emoji } = resolveStatus(userMessagesLast2h, minutesSinceLast);

  return {
    last_user_message_at: lastAt,
    minutes_since_last_user_message: minutesSinceLast,
    messages_last_24h: messagesLast24h,
    avg_messages_per_hour_24h: avgMessagesPerHour,
    peak_hour_today: peakHourLabel,
    peak_hour_count_today: peakCount,
    user_messages_last_2h: userMessagesLast2h,
    status,
    status_label: label,
    status_emoji: emoji,
  };
}

export function formatLastMessageLabel(stats: TrafficHealthStats): string {
  if (stats.minutes_since_last_user_message === null) return 'sin mensajes registrados';
  return formatMinutesAgo(stats.minutes_since_last_user_message);
}
