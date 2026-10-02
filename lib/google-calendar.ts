import 'server-only';
import { google, type calendar_v3 } from 'googleapis';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  buildCalendarSlot,
  customerLocalToUtcDate,
  generateHostCandidateSlots,
  getHostTzParts,
  hostLocalToDate,
  HOST_TIMEZONE,
  isWithinHostBusinessHours,
  MIN_ADVANCE_HOURS as CALENDAR_MIN_ADVANCE_HOURS,
  toGoogleHostDateTime,
} from '@/lib/calendar-slots';
import {
  nameFromEmailLocalPart,
  resolveDemoCustomerName,
} from '@/lib/demo-customer-name';
import { demoDisplayTimezone } from '@/lib/timezone-from-phone';
import {
  DemoSlotUnavailableError,
  pickPrioritySlots,
  slotBlockMessage,
  slotBlockReason,
  type AvailabilityContext,
  type OccupiedInterval,
} from '@/lib/demo-availability';

export const DEMO_TIMEZONE = HOST_TIMEZONE;
export const DEMO_HOST_EMAIL = process.env.DEMO_HOST_EMAIL ?? 'osvamtz@gmail.com';
export const DEMO_HOST_NAME = process.env.DEMO_HOST_NAME ?? 'Equipo Kalyo';
/** User-facing label — never a personal name (keep in sync with demo-booking-messages). */
export const DEMO_HOST_TEAM_LABEL = 'nuestro equipo';

/** Fixed Meet room for all Kalyo demos (no per-event conferenceData). */
export const DEFAULT_DEMO_MEET_LINK = 'https://meet.google.com/pgd-dxmb-sfk';

export function getDemoMeetLink(): string {
  const fromEnv = process.env.KALYO_DEMO_MEET_LINK?.trim();
  return fromEnv || DEFAULT_DEMO_MEET_LINK;
}

export { formatSlotTimeDual } from '@/lib/calendar-slots';
export {
  formatSlotForES,
  formatSlotForCustomerRequest,
  generateHostCandidateSlots,
  getHostTzParts,
  hostLocalToDate,
  isWithinHostBusinessHours,
  parseRelativeDate,
  parseTimeFromText,
  normalizeRequestedTime,
} from '@/lib/calendar-slots';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
];

const DEFAULT_DURATION_MINUTES = 30;

export type CalendarSlot = {
  start: string;
  end: string;
  label_es: string;
  display_timezone: string;
  display_label: string;
};

export type ParsedDateTimeIntent = {
  preferred_day: string;
  preferred_time: string;
};

export type DemoBotContext = {
  conversationId: string;
  botId?: string;
  leadScore?: number | null;
  leadIntent?: string | null;
  signals?: string[] | null;
};

export type CreateDemoEventParams = {
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  scheduledAt: Date;
  durationMinutes?: number;
  botContext: DemoBotContext;
};

export type CreateDemoEventResult = {
  eventId: string;
  meetLink: string;
  demoId: string;
};

type CalendarCredentialsRow = {
  id: string;
  host_email: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  scopes: string[] | null;
};

function getOAuthClient() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_CALENDAR_REDIRECT_URI ??
    'https://botio.dgx.agency/api/admin/google-calendar/callback';

  if (!clientId || !clientSecret) {
    throw new Error('Missing GOOGLE_CALENDAR_CLIENT_ID or GOOGLE_CALENDAR_CLIENT_SECRET');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getGoogleAuthUrl(state: string): string {
  const oauth2 = getOAuthClient();
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state,
  });
}

export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  scopes: string[];
}> {
  const oauth2 = getOAuthClient();
  const { tokens } = await oauth2.getToken(code);
  if (!tokens.access_token) {
    throw new Error('Google OAuth did not return access_token');
  }
  const expiresAt = new Date(tokens.expiry_date ?? Date.now() + 3600 * 1000);
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    expiresAt,
    scopes: tokens.scope?.split(' ') ?? SCOPES,
  };
}

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const OAUTH_STATE_CACHE_PREFIX = 'google_calendar_oauth_state:';

export async function saveGoogleCalendarOAuthState(state: string): Promise<void> {
  const supabase = createAdminClient();
  const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS).toISOString();
  const { error } = await supabase.from('meta_cache').upsert(
    {
      cache_key: `${OAUTH_STATE_CACHE_PREFIX}${state}`,
      payload: { created_at: new Date().toISOString() },
      cached_at: new Date().toISOString(),
      expires_at: expiresAt,
    },
    { onConflict: 'cache_key' },
  );
  if (error) throw new Error(`Failed to save OAuth state: ${error.message}`);
}

export async function consumeGoogleCalendarOAuthState(state: string): Promise<boolean> {
  const supabase = createAdminClient();
  const cacheKey = `${OAUTH_STATE_CACHE_PREFIX}${state}`;
  const { data, error } = await supabase
    .from('meta_cache')
    .select('expires_at')
    .eq('cache_key', cacheKey)
    .maybeSingle();

  if (error || !data?.expires_at) return false;
  if (new Date(data.expires_at).getTime() <= Date.now()) return false;

  await supabase.from('meta_cache').delete().eq('cache_key', cacheKey);
  return true;
}

export async function persistCalendarCredentials(input: {
  hostEmail: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  scopes: string[];
}): Promise<void> {
  const supabase = createAdminClient();

  let refreshToken = input.refreshToken?.trim() ?? '';
  if (!refreshToken) {
    const { data: existing } = await supabase
      .from('calendar_credentials')
      .select('refresh_token')
      .eq('host_email', input.hostEmail)
      .maybeSingle();
    refreshToken = existing?.refresh_token?.trim() ?? '';
  }

  if (!refreshToken) {
    throw new Error(
      'Google no devolvió refresh_token. Revoca el acceso en myaccount.google.com/permissions y vuelve a conectar.',
    );
  }

  const row = {
    host_email: input.hostEmail,
    access_token: input.accessToken,
    refresh_token: refreshToken,
    token_expires_at: input.expiresAt.toISOString(),
    scopes: input.scopes,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('calendar_credentials').upsert(row, {
    onConflict: 'host_email',
  });
  if (error) throw new Error(`Failed to persist calendar credentials: ${error.message}`);
}

export type CalendarConnectionStatus = {
  connected: boolean;
  hostEmail: string;
  /** Access token expiry — refreshes automatically; not the connection lifetime. */
  accessTokenExpiresAt: string | null;
  authorizedAt: string | null;
  hasRefreshToken: boolean;
  healthy: boolean;
  healthError: string | null;
};

async function probeCalendarRefresh(row: CalendarCredentialsRow): Promise<{
  healthy: boolean;
  error: string | null;
  accessTokenExpiresAt?: string;
}> {
  if (!row.refresh_token?.trim()) {
    return { healthy: false, error: 'missing_refresh_token' };
  }

  const oauth2 = getOAuthClient();
  oauth2.setCredentials({ refresh_token: row.refresh_token });

  try {
    const { credentials } = await oauth2.refreshAccessToken();
    if (!credentials.access_token) {
      return { healthy: false, error: 'refresh_returned_no_access_token' };
    }

    const expiresAt = new Date(credentials.expiry_date ?? Date.now() + 3600 * 1000);
    const supabase = createAdminClient();
    await supabase
      .from('calendar_credentials')
      .update({
        access_token: credentials.access_token,
        token_expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);

    return { healthy: true, error: null, accessTokenExpiresAt: expiresAt.toISOString() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/invalid_grant|Token has been expired or revoked/i.test(message)) {
      return { healthy: false, error: 'refresh_token_revoked' };
    }
    return { healthy: false, error: message };
  }
}

export async function getCalendarConnectionStatus(options?: {
  probe?: boolean;
}): Promise<CalendarConnectionStatus> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('calendar_credentials')
    .select('host_email, token_expires_at, refresh_token, updated_at')
    .eq('host_email', DEMO_HOST_EMAIL)
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (!data) {
    return {
      connected: false,
      hostEmail: DEMO_HOST_EMAIL,
      accessTokenExpiresAt: null,
      authorizedAt: null,
      hasRefreshToken: false,
      healthy: false,
      healthError: 'not_connected',
    };
  }

  const hasRefreshToken = Boolean(data.refresh_token?.trim());
  let accessTokenExpiresAt = data.token_expires_at ?? null;
  let healthy = hasRefreshToken;
  let healthError: string | null = hasRefreshToken ? null : 'missing_refresh_token';

  const accessExpired =
    !accessTokenExpiresAt || new Date(accessTokenExpiresAt).getTime() <= Date.now() + 60_000;

  if (options?.probe !== false && hasRefreshToken && accessExpired) {
    const fullRow = await loadCredentials();
    const probe = await probeCalendarRefresh(fullRow);
    healthy = probe.healthy;
    healthError = probe.error;
    if (probe.accessTokenExpiresAt) {
      accessTokenExpiresAt = probe.accessTokenExpiresAt;
    }
  }

  return {
    connected: true,
    hostEmail: DEMO_HOST_EMAIL,
    accessTokenExpiresAt,
    authorizedAt: data.updated_at ?? null,
    hasRefreshToken,
    healthy,
    healthError,
  };
}

async function loadCredentials(): Promise<CalendarCredentialsRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('calendar_credentials')
    .select('*')
    .eq('host_email', DEMO_HOST_EMAIL)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error(
      'Google Calendar not connected. Visit /admin/calendar-settings to authorize.',
    );
  }
  return data as CalendarCredentialsRow;
}

async function refreshAccessToken(
  row: CalendarCredentialsRow,
  oauth2: ReturnType<typeof getOAuthClient>,
): Promise<string> {
  oauth2.setCredentials({ refresh_token: row.refresh_token });
  try {
    const { credentials } = await oauth2.refreshAccessToken();
    if (!credentials.access_token) {
      throw new Error('Failed to refresh Google Calendar access token');
    }

    const expiresAt = new Date(credentials.expiry_date ?? Date.now() + 3600 * 1000);
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('calendar_credentials')
      .update({
        access_token: credentials.access_token,
        token_expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);

    if (error) throw new Error(error.message);
    console.log(`[calendar] credentials refreshed for ${row.host_email}`);
    return credentials.access_token;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/invalid_grant|Token has been expired or revoked/i.test(message)) {
      throw new Error(
        'Google Calendar refresh token expired or revoked. Reconnect at /admin/calendar-settings.',
      );
    }
    throw err;
  }
}

export async function getCalendarClient(): Promise<calendar_v3.Calendar> {
  const row = await loadCredentials();
  const oauth2 = getOAuthClient();

  let accessToken = row.access_token;
  const expiresAt = new Date(row.token_expires_at).getTime();
  if (expiresAt <= Date.now() + 60_000) {
    accessToken = await refreshAccessToken(row, oauth2);
  }

  oauth2.setCredentials({
    access_token: accessToken,
    refresh_token: row.refresh_token,
  });

  return google.calendar({ version: 'v3', auth: oauth2 });
}

export function parseUserDateTimeIntent(text: string, currentDate = new Date()): ParsedDateTimeIntent {
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  let preferred_day = 'any';
  let preferred_time = 'any';

  if (/manana|mañana/.test(normalized) && /pasado/.test(normalized)) {
    preferred_day = 'pasado_manana';
  } else if (/manana|mañana/.test(normalized)) {
    preferred_day = 'manana';
  } else if (/lunes/.test(normalized)) preferred_day = 'lunes';
  else if (/martes/.test(normalized)) preferred_day = 'martes';
  else if (/miercoles|miércoles/.test(normalized)) preferred_day = 'miercoles';
  else if (/jueves/.test(normalized)) preferred_day = 'jueves';
  else if (/viernes/.test(normalized)) preferred_day = 'viernes';
  else if (/sabado|sábado/.test(normalized)) preferred_day = 'sabado';

  if (/mañana|manana/.test(normalized) && !/pasado/.test(normalized) && /tarde|noche/.test(normalized)) {
    preferred_time = 'tarde';
  } else if (/tarde/.test(normalized)) preferred_time = 'tarde';
  else if (/mañana|manana/.test(normalized) && !/pasado/.test(normalized)) preferred_time = 'manana';
  else if (/\d{1,2}\s*(am|pm|:\d{2})/.test(normalized)) preferred_time = normalized;

  void currentDate;
  return { preferred_day, preferred_time };
}

function addDaysHost(base: Date, days: number): Date {
  const p = getHostTzParts(base);
  const d = hostLocalToDate(p.year, p.month, p.day, 12, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function matchesPreferences(
  slotStart: Date,
  preferredDay: string,
  preferredTime: string,
  now: Date,
): boolean {
  if (preferredDay === 'any' && preferredTime === 'any') return true;

  const parts = getHostTzParts(slotStart);

  if (preferredDay !== 'any') {
    const dayNames = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const targetDay = dayNames[parts.weekday];
    if (preferredDay === 'manana') {
      const tomorrow = addDaysHost(now, 1);
      const tp = getHostTzParts(tomorrow);
      if (parts.year !== tp.year || parts.month !== tp.month || parts.day !== tp.day) return false;
    } else if (preferredDay === 'pasado_manana') {
      const dayAfter = addDaysHost(now, 2);
      const tp = getHostTzParts(dayAfter);
      if (parts.year !== tp.year || parts.month !== tp.month || parts.day !== tp.day) return false;
    } else if (targetDay !== preferredDay) {
      return false;
    }
  }

  if (preferredTime !== 'any') {
    if (preferredTime === 'manana' && parts.hour >= 12) return false;
    if (preferredTime === 'tarde' && parts.hour < 12) return false;
  }

  return true;
}

export type GetAvailableSlotsParams = {
  startDate?: Date;
  endDate?: Date;
  durationMinutes?: number;
  preferredDay?: string;
  preferredTime?: string;
  customerPhone?: string;
  customerTimezone?: string;
  customerLabel?: string;
};

export type AvailableSlotsResult = {
  slots: CalendarSlot[];
  overlap_limited?: boolean;
};

function offerSlot(
  slotStart: Date,
  durationMinutes: number,
  phone?: string,
  timezone?: string,
  label?: string,
): CalendarSlot {
  const display = demoDisplayTimezone(phone, { timezone, label });
  return buildCalendarSlot(
    slotStart,
    durationMinutes,
    phone,
    display.timezone,
    display.label,
  );
}

export async function getAvailableSlots(
  params: GetAvailableSlotsParams = {},
): Promise<AvailableSlotsResult> {
  const durationMinutes = params.durationMinutes ?? DEFAULT_DURATION_MINUTES;
  const now = new Date();
  const earliest = new Date(now.getTime() + CALENDAR_MIN_ADVANCE_HOURS * 60 * 60 * 1000);

  const startDate = params.startDate ?? earliest;
  const endDate = params.endDate ?? new Date(earliest.getTime() + 7 * 24 * 60 * 60 * 1000);

  console.log(
    `[calendar] checking availability | from=${startDate.toISOString()} to=${endDate.toISOString()}`,
  );

  const ctx = await loadAvailabilityContext({
    from: startDate,
    to: endDate,
    reference: now,
    durationMinutes,
  });

  let candidates = generateHostCandidateSlots(startDate, endDate, durationMinutes).filter(
    (slotStart) => slotBlockReason(slotStart, ctx) === null,
  );

  const preferredDay = params.preferredDay ?? 'any';
  const preferredTime = params.preferredTime ?? 'any';

  if (preferredDay !== 'any' || preferredTime !== 'any') {
    const filtered = candidates.filter((slot) =>
      matchesPreferences(slot, preferredDay, preferredTime, now),
    );
    if (filtered.length > 0) candidates = filtered;
  }

  const selected = pickPrioritySlots(candidates, 3);
  console.log(`[calendar] found ${selected.length} slots`);

  return {
    slots: selected.map((slotStart) =>
      offerSlot(
        slotStart,
        durationMinutes,
        params.customerPhone,
        params.customerTimezone,
        params.customerLabel,
      ),
    ),
  };
}

function formatAlternativesBotMessage(prefix: string, alternatives: CalendarSlot[]): string {
  if (alternatives.length === 0) {
    return `${prefix} ¿Quieres que consulte otros días?`;
  }
  const lines = alternatives.map((slot, i) => `${i + 1}️⃣ ${slot.label_es}`);
  return `${prefix}\n${lines.join('\n')}\n\n¿Cuál te viene mejor? Responde con 1, 2 o 3.`;
}

async function queryFreeBusyForRange(
  start: Date,
  end: Date,
): Promise<{ start?: string | null; end?: string | null }[]> {
  const calendar = await getCalendarClient();
  const freebusy = await calendar.freebusy.query({
    requestBody: {
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      timeZone: DEMO_TIMEZONE,
      items: [{ id: DEMO_HOST_EMAIL }],
    },
  });
  return freebusy.data.calendars?.[DEMO_HOST_EMAIL]?.busy ?? [];
}

function parseBusyIntervals(
  busy: { start?: string | null; end?: string | null }[],
): OccupiedInterval[] {
  return busy.flatMap((block) => {
    if (!block.start || !block.end) return [];
    const start = new Date(block.start);
    const end = new Date(block.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
    return [{ start, end }];
  });
}

async function loadBookedIntervals(
  excludeBookingId?: string,
  focus?: Date,
): Promise<OccupiedInterval[]> {
  const supabase = createAdminClient();
  const from = new Date(Date.now() - 24 * 60 * 60 * 1000);
  let to = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
  if (focus && focus.getTime() + 2 * 24 * 60 * 60 * 1000 > to.getTime()) {
    to = new Date(focus.getTime() + 2 * 24 * 60 * 60 * 1000);
  }

  const [demos, bookings] = await Promise.all([
    supabase
      .from('scheduled_demos')
      .select('scheduled_at, duration_minutes')
      .eq('status', 'scheduled')
      .gte('scheduled_at', from.toISOString())
      .lt('scheduled_at', to.toISOString()),
    supabase
      .from('demo_bookings')
      .select('id, scheduled_at')
      .in('status', ['pending', 'confirmed', 'rescheduled_by_admin'])
      .gte('scheduled_at', from.toISOString())
      .lt('scheduled_at', to.toISOString()),
  ]);

  if (demos.error) throw new Error(demos.error.message);
  if (bookings.error) throw new Error(bookings.error.message);

  const intervals: OccupiedInterval[] = [];
  for (const row of demos.data ?? []) {
    const start = new Date(row.scheduled_at as string);
    const duration =
      typeof row.duration_minutes === 'number' ? row.duration_minutes : DEFAULT_DURATION_MINUTES;
    intervals.push({ start, end: new Date(start.getTime() + duration * 60_000) });
  }
  for (const row of bookings.data ?? []) {
    if (excludeBookingId && row.id === excludeBookingId) continue;
    const start = new Date(row.scheduled_at as string);
    intervals.push({
      start,
      end: new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60_000),
    });
  }
  return intervals;
}

async function loadAvailabilityContext(params: {
  from: Date;
  to: Date;
  reference?: Date;
  durationMinutes?: number;
  excludeBookingId?: string;
}): Promise<AvailabilityContext> {
  const [bookings, busy] = await Promise.all([
    loadBookedIntervals(params.excludeBookingId, params.to),
    queryFreeBusyForRange(params.from, params.to),
  ]);
  return {
    bookings,
    busy: parseBusyIntervals(busy),
    reference: params.reference ?? new Date(),
    durationMinutes: params.durationMinutes ?? DEFAULT_DURATION_MINUTES,
  };
}

export async function assertDemoSlotBookable(params: {
  slotStart: Date;
  durationMinutes?: number;
  excludeBookingId?: string;
}): Promise<void> {
  const durationMinutes = params.durationMinutes ?? DEFAULT_DURATION_MINUTES;
  const padMs = 2 * 60 * 60 * 1000;
  const ctx = await loadAvailabilityContext({
    from: new Date(params.slotStart.getTime() - padMs),
    to: new Date(params.slotStart.getTime() + durationMinutes * 60_000 + padMs),
    durationMinutes,
    excludeBookingId: params.excludeBookingId,
  });
  const reason = slotBlockReason(params.slotStart, ctx);
  if (reason) {
    throw new DemoSlotUnavailableError(reason, slotBlockMessage(reason));
  }
}

async function findAlternativesNear(
  anchor: Date,
  durationMinutes: number,
  phone?: string,
  timezone?: string,
  label?: string,
): Promise<CalendarSlot[]> {
  const now = new Date();
  const earliest = new Date(now.getTime() + CALENDAR_MIN_ADVANCE_HOURS * 60 * 60 * 1000);
  const windowStart = new Date(Math.max(anchor.getTime() - 2 * 60 * 60 * 1000, earliest.getTime()));
  const windowEnd = new Date(anchor.getTime() + 2 * 60 * 60 * 1000);
  const ctx = await loadAvailabilityContext({
    from: windowStart,
    to: windowEnd,
    reference: now,
    durationMinutes,
  });

  const candidates = generateHostCandidateSlots(windowStart, windowEnd, durationMinutes).filter(
    (slotStart) => slotBlockReason(slotStart, ctx) === null,
  );

  return pickPrioritySlots(candidates, 3).map((slotStart) =>
    offerSlot(slotStart, durationMinutes, phone, timezone, label),
  );
}

async function getFallbackAlternatives(
  anchor: Date,
  durationMinutes: number,
  customerPhone?: string,
  customerTimezone?: string,
  customerLabel?: string,
): Promise<CalendarSlot[]> {
  const near = await findAlternativesNear(
    anchor,
    durationMinutes,
    customerPhone,
    customerTimezone,
    customerLabel,
  );
  if (near.length >= 3) return near;

  const general = await getAvailableSlots({
    customerPhone,
    customerTimezone,
    customerLabel,
    durationMinutes,
    preferredDay: 'any',
    preferredTime: 'any',
  });
  const merged = [...near];
  for (const slot of general.slots) {
    if (merged.length >= 3) break;
    if (!merged.some((m) => m.start === slot.start)) merged.push(slot);
  }
  return merged.slice(0, 3);
}

export type CheckSpecificTimeParams = {
  requestedDate: string;
  requestedTime: string;
  customerTimezone: string;
  customerLabel?: string;
  customerPhone?: string;
  durationMinutes?: number;
};

export type CheckSpecificTimeResult = {
  status:
    | 'available'
    | 'busy'
    | 'outside_hours'
    | 'outside_customer_hours'
    | 'too_soon'
    | 'invalid';
  slot?: CalendarSlot;
  alternatives?: CalendarSlot[];
  bot_message: string;
};

export async function checkSpecificTime(
  params: CheckSpecificTimeParams,
): Promise<CheckSpecificTimeResult> {
  const durationMinutes = params.durationMinutes ?? DEFAULT_DURATION_MINUTES;
  const display = demoDisplayTimezone(params.customerPhone, {
    timezone: params.customerTimezone,
    label: params.customerLabel,
  });
  const tz = display.timezone;
  const label = display.label;

  let slotStart: Date;
  try {
    slotStart = customerLocalToUtcDate(params.requestedDate, params.requestedTime, tz);
  } catch {
    return {
      status: 'invalid',
      bot_message: 'No pude entender esa fecha u hora. ¿Me la repites? (ej: lunes 12:30)',
    };
  }

  const now = new Date();
  const earliest = new Date(now.getTime() + CALENDAR_MIN_ADVANCE_HOURS * 60 * 60 * 1000);

  if (slotStart.getTime() < earliest.getTime()) {
    const alternatives = await getFallbackAlternatives(
      earliest,
      durationMinutes,
      params.customerPhone,
      tz,
      label,
    );
    return {
      status: 'too_soon',
      alternatives,
      bot_message: formatAlternativesBotMessage(
        'Necesito al menos 12 horas de anticipación para agendar. Te ofrezco estas opciones:',
        alternatives,
      ),
    };
  }

  if (!isWithinHostBusinessHours(slotStart, durationMinutes)) {
    const alternatives = await getFallbackAlternatives(
      slotStart,
      durationMinutes,
      params.customerPhone,
      tz,
      label,
    );
    return {
      status: 'outside_hours',
      alternatives,
      bot_message: formatAlternativesBotMessage(
        'Ese horario está fuera del horario de demos (lun–vie 9:00–18:00, sáb 9:00–13:00, hora de Colombia). Te ofrezco:',
        alternatives,
      ),
    };
  }

  console.log(
    `[calendar] checking specific time | requested=${params.requestedDate} ${params.requestedTime} ${tz} | utc=${slotStart.toISOString()}`,
  );

  const ctx = await loadAvailabilityContext({
    from: new Date(slotStart.getTime() - 2 * 60 * 60 * 1000),
    to: new Date(slotStart.getTime() + 2 * 60 * 60 * 1000),
    reference: now,
    durationMinutes,
  });
  const reason = slotBlockReason(slotStart, ctx);
  if (reason) {
    const alternatives = await findAlternativesNear(slotStart, durationMinutes);
    const fallback =
      alternatives.length > 0
        ? alternatives
        : await getFallbackAlternatives(slotStart, durationMinutes, params.customerPhone, tz, label);
    return {
      status: reason === 'outside_hours' ? 'outside_hours' : 'busy',
      alternatives: fallback,
      bot_message: formatAlternativesBotMessage(slotBlockMessage(reason), fallback),
    };
  }

  const built = offerSlot(
    slotStart,
    durationMinutes,
    params.customerPhone,
    tz,
    label,
  );
  return {
    status: 'available',
    slot: built,
    bot_message: `¡Sí! ${built.label_es} está disponible. ¿Confirmamos?`,
  };
}

export function formatSlotsForBot(
  slots: CalendarSlot[],
  options?: { overlap_limited?: boolean },
): string {
  if (slots.length === 0) {
    return 'No encontré horarios disponibles en los próximos días. ¿Te funciona algún día de la próxima semana?';
  }

  const lines = slots.map((slot, i) => `${i + 1}️⃣ ${slot.label_es}`);
  const prefix = options?.overlap_limited
    ? 'Tu zona horaria tiene poco overlap con nuestro horario laboral. Te ofrezco los horarios disponibles incluso fuera de tu rango ideal:\n'
    : 'Aquí tienes horarios disponibles:\n';

  return (
    prefix +
    lines.join('\n') +
    '\n\n¿Cuál te viene mejor? Responde con 1, 2 o 3.'
  );
}

export async function createDemoEvent(params: CreateDemoEventParams): Promise<CreateDemoEventResult> {
  const durationMinutes = params.durationMinutes ?? DEFAULT_DURATION_MINUTES;
  await assertDemoSlotBookable({
    slotStart: params.scheduledAt,
    durationMinutes,
  });
  const calendar = await getCalendarClient();
  const scheduledAt = params.scheduledAt;
  const endAt = new Date(scheduledAt.getTime() + durationMinutes * 60_000);
  const meetLink = getDemoMeetLink();
  const safeCustomerName = resolveDemoCustomerName({
    formName: params.customerName,
    emailLocalPart: nameFromEmailLocalPart(params.customerEmail),
  });

  const signals = params.botContext.signals?.join(', ') ?? '—';
  const description = [
    `Demo de ${durationMinutes} minutos con ${safeCustomerName}`,
    '',
    `Meet: ${meetLink}`,
    '',
    `Email: ${params.customerEmail}`,
    `Teléfono: ${params.customerPhone ?? '—'}`,
    `Score: ${params.botContext.leadScore ?? '—'}/100`,
    `Intent: ${params.botContext.leadIntent ?? '—'}`,
    `Señales: ${signals}`,
    '',
    'Ver conversación: https://botio.dgx.agency/admin/conversations',
    `Conversation ID: ${params.botContext.conversationId}`,
  ].join('\n');

  const event = await calendar.events.insert({
    calendarId: 'primary',
    sendUpdates: 'all',
    requestBody: {
      summary: `Demo Kalyo — ${safeCustomerName}`,
      description,
      location: meetLink,
      start: {
        dateTime: toGoogleHostDateTime(scheduledAt),
        timeZone: DEMO_TIMEZONE,
      },
      end: {
        dateTime: toGoogleHostDateTime(endAt),
        timeZone: DEMO_TIMEZONE,
      },
      attendees: [
        { email: DEMO_HOST_EMAIL, displayName: DEMO_HOST_NAME },
        { email: params.customerEmail, displayName: safeCustomerName },
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 },
          { method: 'popup', minutes: 10 },
        ],
      },
    },
  });

  const eventId = event.data.id;
  if (!eventId) throw new Error('Google Calendar did not return event id');

  console.log(`[calendar] event created | event_id=${eventId} | meet=${meetLink}`);

  const supabase = createAdminClient();
  const { data: demoRow, error } = await supabase
    .from('scheduled_demos')
    .insert({
      conversation_id: params.botContext.conversationId,
      bot_id: params.botContext.botId ?? null,
      customer_email: params.customerEmail,
      customer_name: safeCustomerName,
      customer_phone: params.customerPhone ?? null,
      scheduled_at: scheduledAt.toISOString(),
      duration_minutes: durationMinutes,
      google_event_id: eventId,
      google_meet_link: meetLink,
      status: 'scheduled',
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);

  console.log(
    `[demo-scheduled] conv=${params.botContext.conversationId} demo_id=${demoRow.id} at=${scheduledAt.toISOString()}`,
  );

  try {
    const { notifyDemoConfirmed } = await import('@/lib/demo-confirmed-notify');
    await notifyDemoConfirmed({
      customerName: safeCustomerName,
      customerEmail: params.customerEmail,
      customerPhone: params.customerPhone,
      scheduledAt,
      meetLink,
      source: 'whatsapp_bot',
      conversationId: params.botContext.conversationId,
    });
  } catch (err) {
    console.error(
      '[demo-scheduled] notify failed (non-fatal)',
      err instanceof Error ? err.message : err,
    );
  }

  return { eventId, meetLink, demoId: demoRow.id };
}

export async function deleteDemoCalendarEvent(googleEventId: string): Promise<void> {
  if (!googleEventId) return;
  const calendar = await getCalendarClient();
  await calendar.events.delete({
    calendarId: 'primary',
    eventId: googleEventId,
    sendUpdates: 'all',
  });
}

export async function cancelDemoEvent(demoId: string, reason: string): Promise<void> {
  const supabase = createAdminClient();
  const { data: demo, error } = await supabase
    .from('scheduled_demos')
    .select('*')
    .eq('id', demoId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!demo) throw new Error('Demo not found');
  if (demo.status === 'cancelled') return;

  if (demo.google_event_id) {
    await deleteDemoCalendarEvent(demo.google_event_id);
  }

  const { error: updateError } = await supabase
    .from('scheduled_demos')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason,
    })
    .eq('id', demoId);

  if (updateError) throw new Error(updateError.message);
}

export { formatDemoConfirmationMessage } from '@/lib/demo-booking-messages';

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
