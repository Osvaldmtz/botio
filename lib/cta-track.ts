import {
  CTA_EVENT_NAMES,
  getCtaValueUsd,
  isCtaEventName,
} from '@/lib/cta-events-utils';

const ALLOWED_ORIGINS = new Set([
  'https://kalyo.io',
  'https://www.kalyo.io',
  'https://app.kalyo.io',
]);

export function ctaTrackCorsHeaders(origin: string | null): HeadersInit {
  const allowedOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : ALLOWED_ORIGINS.values().next().value!;
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function cleanString(value: unknown, maxLen = 200): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

export type CtaTrackPayload = {
  event: string;
  source?: string | null;
  session_id?: string | null;
  country?: string | null;
  city?: string | null;
};

export function parseCtaTrackPayload(body: unknown): CtaTrackPayload | { error: string } {
  const raw = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const event =
    cleanString(raw.event, 80) ??
    cleanString(raw.event_name, 80);

  if (!event || !isCtaEventName(event)) {
    return { error: 'Invalid event' };
  }

  const source = cleanString(raw.source, 80);
  if (source && source !== 'landing' && source !== 'app') {
    return { error: 'Invalid source' };
  }

  return {
    event,
    source: source ?? null,
    session_id: cleanString(raw.session_id, 120),
    country: cleanString(raw.country, 120),
    city: cleanString(raw.city, 120),
  };
}

export function buildCtaEventInsert(payload: CtaTrackPayload) {
  const eventName = payload.event;
  if (!isCtaEventName(eventName)) {
    throw new Error('Invalid event');
  }

  return {
    event_name: eventName,
    source: payload.source ?? 'landing',
    session_id: payload.session_id,
    country: payload.country,
    city: payload.city,
    value_usd: getCtaValueUsd(eventName),
    event_timestamp: new Date().toISOString(),
  };
}

export { CTA_EVENT_NAMES, isCtaEventName };
