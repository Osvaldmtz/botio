import { toZonedTime } from 'date-fns-tz';
import type { SupabaseClient } from '@supabase/supabase-js';

const MX_TZ = 'America/Mexico_City';
const DEDUPE_KEY_CRITICAL = 'traffic_monitor:critical';
const DEDUPE_KEY_LOW = 'traffic_monitor:low';
const DEDUPE_TTL_MS = 2 * 60 * 60 * 1000;

export type MexicoTimeContext = {
  hourMx: number;
  dayMx: number;
  isActiveHours: boolean;
  isWeekday: boolean;
};

export type TrafficAlertDecision =
  | { kind: 'none' }
  | { kind: 'critical' }
  | { kind: 'low'; count: number };

export function getMexicoTimeContext(at = new Date()): MexicoTimeContext {
  const nowMx = toZonedTime(at, MX_TZ);
  const hourMx = nowMx.getHours();
  const dayMx = nowMx.getDay();
  const isActiveHours = hourMx >= 8 && hourMx <= 22;
  const isWeekday = dayMx >= 1 && dayMx <= 5;
  return { hourMx, dayMx, isActiveHours, isWeekday };
}

export function evaluateTrafficAlert(
  userMessages: number | null,
  ctx: MexicoTimeContext,
): TrafficAlertDecision {
  if (!ctx.isActiveHours || !ctx.isWeekday) return { kind: 'none' };
  if (userMessages === 0) return { kind: 'critical' };
  if (userMessages !== null && userMessages < 3) return { kind: 'low', count: userMessages };
  return { kind: 'none' };
}

export function buildCriticalAlertMessage(ctx: MexicoTimeContext): string {
  return (
    `🚨 ALERTA CRÍTICA — Bot sin mensajes\n\n` +
    `Detectado: 0 mensajes inbound en últimas 2 horas\n` +
    `Hora actual: ${ctx.hourMx}:00 MX (${ctx.isWeekday ? 'día laboral' : 'fin de semana'})\n\n` +
    `Posibles causas:\n` +
    `1. Webhook Twilio caído\n` +
    `2. Kalyo router caído\n` +
    `3. Botio procesador caído\n` +
    `4. Meta Ads pausadas\n\n` +
    `Acción inmediata:\n` +
    `- Test manual: mandar mensaje a +15559374917\n` +
    `- Revisar https://botio.dgx.agency/admin/conversations\n` +
    `- Verificar Twilio Console`
  );
}

export function buildLowTrafficAlertMessage(userMessages: number): string {
  return (
    `🟡 ALERTA — Tráfico bajo\n` +
    `Solo ${userMessages} mensajes en últimas 2h en horario activo.`
  );
}

export async function countUserMessagesLast2h(
  supabase: SupabaseClient,
): Promise<number | null> {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const { count, error } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'user')
    .gte('created_at', twoHoursAgo.toISOString());

  if (error) {
    console.error('[traffic-monitor] count failed', error.message);
    return null;
  }

  return count ?? 0;
}

async function wasRecentlyAlerted(
  supabase: SupabaseClient,
  cacheKey: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('meta_cache')
    .select('expires_at')
    .eq('cache_key', cacheKey)
    .maybeSingle();

  if (!data?.expires_at) return false;
  return new Date(data.expires_at) > new Date();
}

async function markAlerted(supabase: SupabaseClient, cacheKey: string): Promise<void> {
  const expiresAt = new Date(Date.now() + DEDUPE_TTL_MS).toISOString();
  await supabase.from('meta_cache').upsert(
    {
      cache_key: cacheKey,
      payload: { sent_at: new Date().toISOString() },
      expires_at: expiresAt,
    },
    { onConflict: 'cache_key' },
  );
}

export type TrafficMonitorResult = {
  user_messages_last_2h: number | null;
  hour_mx: number;
  is_active_hours: boolean;
  is_weekday: boolean;
  alert_sent: boolean;
  alert_kind: TrafficAlertDecision['kind'];
};

export async function runTrafficMonitor(
  supabase: SupabaseClient,
  sendAlert: (text: string) => Promise<{ sent: boolean }>,
  at = new Date(),
): Promise<TrafficMonitorResult> {
  const ctx = getMexicoTimeContext(at);
  const userMessages = await countUserMessagesLast2h(supabase);
  const decision = evaluateTrafficAlert(userMessages, ctx);

  let alertSent = false;

  if (decision.kind === 'critical') {
    const deduped = await wasRecentlyAlerted(supabase, DEDUPE_KEY_CRITICAL);
    if (!deduped) {
      const result = await sendAlert(buildCriticalAlertMessage(ctx));
      if (result.sent) {
        await markAlerted(supabase, DEDUPE_KEY_CRITICAL);
        alertSent = true;
      }
    }
  } else if (decision.kind === 'low') {
    const deduped = await wasRecentlyAlerted(supabase, DEDUPE_KEY_LOW);
    if (!deduped) {
      const result = await sendAlert(buildLowTrafficAlertMessage(decision.count));
      if (result.sent) {
        await markAlerted(supabase, DEDUPE_KEY_LOW);
        alertSent = true;
      }
    }
  }

  return {
    user_messages_last_2h: userMessages,
    hour_mx: ctx.hourMx,
    is_active_hours: ctx.isActiveHours,
    is_weekday: ctx.isWeekday,
    alert_sent: alertSent,
    alert_kind: decision.kind,
  };
}
