import 'server-only';
import { randomUUID } from 'node:crypto';
import { google, type calendar_v3 } from 'googleapis';
import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  formatSlotForES,
  formatSlotLabelsForPhone,
  generateHostCandidateSlots,
  getHostTzParts,
  hostLocalToDate,
  HOST_TIMEZONE,
  isWithinHostBusinessHours,
  toGoogleHostDateTime,
} from '@/lib/calendar-slots';
import {
  getCustomerTimezone,
  getCustomerTimezoneLabel,
  type CustomerTimezone,
  type CustomerTimezoneLabel,
} from '@/lib/timezone-from-phone';

export const DEMO_TIMEZONE = HOST_TIMEZONE;
export const DEMO_HOST_EMAIL = process.env.DEMO_HOST_EMAIL ?? 'osvamtz@gmail.com';
export const DEMO_HOST_NAME = process.env.DEMO_HOST_NAME ?? 'Osvaldo Martínez';
export const DEMO_HOST_TEAM_LABEL = 'Osvaldo del equipo de Kalyo';

export {
  formatSlotForES,
  generateHostCandidateSlots,
  getHostTzParts,
  hostLocalToDate,
  isWithinHostBusinessHours,
} from '@/lib/calendar-slots';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
];

const WORK_START_HOUR = 9;
const WORK_END_HOUR = 20;
const DEFAULT_DURATION_MINUTES = 15;
const MIN_ADVANCE_HOURS = 24;

export type CalendarSlot = {
  start: string;
  end: string;
  label_es: string;
  display_timezone: CustomerTimezone;
  display_label: CustomerTimezoneLabel;
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
  meetLink: string | null;
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
  refreshToken: string;
  expiresAt: Date;
  scopes: string[];
}> {
  const oauth2 = getOAuthClient();
  const { tokens } = await oauth2.getToken(code);
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Google OAuth did not return access_token or refresh_token');
  }
  const expiresAt = new Date(tokens.expiry_date ?? Date.now() + 3600 * 1000);
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt,
    scopes: tokens.scope?.split(' ') ?? SCOPES,
  };
}

export async function persistCalendarCredentials(input: {
  hostEmail: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scopes: string[];
}): Promise<void> {
  const supabase = createAdminClient();
  const row = {
    host_email: input.hostEmail,
    access_token: input.accessToken,
    refresh_token: input.refreshToken,
    token_expires_at: input.expiresAt.toISOString(),
    scopes: input.scopes,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('calendar_credentials').upsert(row, {
    onConflict: 'host_email',
  });
  if (error) throw new Error(`Failed to persist calendar credentials: ${error.message}`);
}

export async function getCalendarConnectionStatus(): Promise<{
  connected: boolean;
  hostEmail: string;
  expiresAt: string | null;
}> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('calendar_credentials')
    .select('host_email, token_expires_at')
    .eq('host_email', DEMO_HOST_EMAIL)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return {
    connected: Boolean(data),
    hostEmail: DEMO_HOST_EMAIL,
    expiresAt: data?.token_expires_at ?? null,
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

function slotOverlapsBusy(
  slotStart: Date,
  slotEnd: Date,
  busy: { start?: string | null; end?: string | null }[],
): boolean {
  const s = slotStart.getTime();
  const e = slotEnd.getTime();
  return busy.some((b) => {
    if (!b.start || !b.end) return false;
    const bs = new Date(b.start).getTime();
    const be = new Date(b.end).getTime();
    return s < be && e > bs;
  });
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

function pickDistributedSlots(candidates: Date[], max = 3): Date[] {
  if (candidates.length <= max) return candidates;

  const morning = candidates.filter((d) => getHostTzParts(d).hour < 12);
  const afternoon = candidates.filter((d) => getHostTzParts(d).hour >= 12);

  const picked: Date[] = [];
  const usedDays = new Set<string>();

  const dayKey = (d: Date) => {
    const p = getHostTzParts(d);
    return `${p.year}-${p.month}-${p.day}`;
  };

  if (morning[0]) {
    picked.push(morning[0]);
    usedDays.add(dayKey(morning[0]));
  }
  if (afternoon[0] && picked.length < max) {
    const alt = afternoon.find((d) => !usedDays.has(dayKey(d))) ?? afternoon[0];
    picked.push(alt);
    usedDays.add(dayKey(alt));
  }

  for (const slot of candidates) {
    if (picked.length >= max) break;
    if (!picked.some((p) => p.getTime() === slot.getTime())) {
      picked.push(slot);
    }
  }

  return picked.slice(0, max).sort((a, b) => a.getTime() - b.getTime());
}

export type GetAvailableSlotsParams = {
  startDate?: Date;
  endDate?: Date;
  durationMinutes?: number;
  preferredDay?: string;
  preferredTime?: string;
  customerPhone?: string;
};

export async function getAvailableSlots(params: GetAvailableSlotsParams = {}): Promise<CalendarSlot[]> {
  const durationMinutes = params.durationMinutes ?? DEFAULT_DURATION_MINUTES;
  const now = new Date();
  const earliest = new Date(now.getTime() + MIN_ADVANCE_HOURS * 60 * 60 * 1000);

  const startDate = params.startDate ?? earliest;
  const endDate = params.endDate ?? new Date(earliest.getTime() + 7 * 24 * 60 * 60 * 1000);

  console.log(
    `[calendar] checking availability | from=${startDate.toISOString()} to=${endDate.toISOString()}`,
  );

  const calendar = await getCalendarClient();
  const freebusy = await calendar.freebusy.query({
    requestBody: {
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      timeZone: DEMO_TIMEZONE,
      items: [{ id: DEMO_HOST_EMAIL }],
    },
  });

  const busy = freebusy.data.calendars?.[DEMO_HOST_EMAIL]?.busy ?? [];

  let candidates = generateHostCandidateSlots(startDate, endDate, durationMinutes)
    .filter((slotStart) => isWithinHostBusinessHours(slotStart, durationMinutes))
    .filter((slotStart) => {
      const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000);
      return !slotOverlapsBusy(slotStart, slotEnd, busy);
    });

  const preferredDay = params.preferredDay ?? 'any';
  const preferredTime = params.preferredTime ?? 'any';

  if (preferredDay !== 'any' || preferredTime !== 'any') {
    const filtered = candidates.filter((s) =>
      matchesPreferences(s, preferredDay, preferredTime, now),
    );
    if (filtered.length > 0) candidates = filtered;
  }

  const selected = pickDistributedSlots(candidates, 3);
  console.log(`[calendar] found ${selected.length} slots`);

  return selected.map((slotStart) => {
    const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000);
    const hostHour = getHostTzParts(slotStart).hour;
    if (hostHour < WORK_START_HOUR || hostHour >= WORK_END_HOUR) {
      console.warn(`[calendar] slot outside host hours skipped | host_hour=${hostHour}`);
    }
    const labels = formatSlotLabelsForPhone(slotStart, params.customerPhone);
    return {
      start: slotStart.toISOString(),
      end: slotEnd.toISOString(),
      ...labels,
    };
  });
}

export function formatSlotsForBot(slots: CalendarSlot[]): string {
  if (slots.length === 0) {
    return 'No encontré horarios disponibles en los próximos días. ¿Te funciona algún día de la próxima semana?';
  }

  const lines = slots.map((slot, i) => `${i + 1}️⃣ ${slot.label_es}`);
  return (
    'Aquí tienes horarios disponibles:\n' +
    lines.join('\n') +
    '\n\n¿Cuál te viene mejor? Responde con 1, 2 o 3.'
  );
}

export async function createDemoEvent(params: CreateDemoEventParams): Promise<CreateDemoEventResult> {
  const durationMinutes = params.durationMinutes ?? DEFAULT_DURATION_MINUTES;
  const calendar = await getCalendarClient();
  const scheduledAt = params.scheduledAt;
  const endAt = new Date(scheduledAt.getTime() + durationMinutes * 60_000);

  const signals = params.botContext.signals?.join(', ') ?? '—';
  const description = [
    `Demo de ${durationMinutes} minutos con ${params.customerName}`,
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

  const requestId = randomUUID();
  const event = await calendar.events.insert({
    calendarId: 'primary',
    conferenceDataVersion: 1,
    sendUpdates: 'all',
    requestBody: {
      summary: `Demo Kalyo — ${params.customerName}`,
      description,
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
        { email: params.customerEmail, displayName: params.customerName },
      ],
      conferenceData: {
        createRequest: {
          requestId,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
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

  const meetLink =
    event.data.hangoutLink ??
    event.data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ??
    null;

  console.log(`[calendar] event created | event_id=${eventId} | meet=${meetLink ?? '—'}`);

  const supabase = createAdminClient();
  const { data: demoRow, error } = await supabase
    .from('scheduled_demos')
    .insert({
      conversation_id: params.botContext.conversationId,
      bot_id: params.botContext.botId ?? null,
      customer_email: params.customerEmail,
      customer_name: params.customerName,
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

  return { eventId, meetLink, demoId: demoRow.id };
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
    const calendar = await getCalendarClient();
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: demo.google_event_id,
      sendUpdates: 'all',
    });
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

export function formatDemoConfirmationMessage(
  scheduledAt: Date,
  customerEmail: string,
  customerPhone?: string,
): string {
  const displayTimezone = getCustomerTimezone(customerPhone);
  const displayLabel = getCustomerTimezoneLabel(customerPhone);
  const dateLabel = formatSlotForES(scheduledAt, displayTimezone, displayLabel);
  const timeLabel = formatInTimeZone(scheduledAt, displayTimezone, 'HH:mm', { locale: es });

  return (
    '✅ ¡Demo agendada!\n\n' +
    `📅 ${dateLabel}\n` +
    `⏰ ${timeLabel} hora ${displayLabel}\n` +
    `👤 Con ${DEMO_HOST_TEAM_LABEL}\n` +
    '🎥 Te llegará el link de Google Meet por email\n' +
    `📨 Invitación enviada a ${customerEmail}\n\n` +
    'Te llegará un recordatorio 1 hora antes. ¿Algo más en lo que te pueda ayudar?'
  );
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
