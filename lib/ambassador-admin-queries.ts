import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export type AmbassadorFilter = 'all' | 'registered' | 'unregistered';

export type AmbassadorRow = {
  id: string;
  customer_phone: string;
  email: string | null;
  name: string | null;
  created_at: string;
  webinar_link_sent_at: string | null;
  webinar_registered: boolean;
  webinar_attended: boolean;
  msg_count: number;
  last_msg_at: string | null;
  lead_country: string | null;
  metadata: Record<string, unknown>;
};

export type AmbassadorMetrics = {
  total_leads: number;
  luma_registered: number;
  registration_rate: number;
  link_sent: number;
  attended: number;
};

function readMetadataString(metadata: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function readWebinarAttended(metadata: Record<string, unknown>): boolean {
  return metadata.webinar_attended === true || metadata.webinar_attended === 'true';
}

export async function fetchAmbassadorMetrics(
  supabase: SupabaseClient,
): Promise<AmbassadorMetrics> {
  const since = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();

  const { data, error } = await supabase
    .from('conversations')
    .select('id, webinar_registered, webinar_link_sent_at, metadata')
    .eq('is_ambassador', true)
    .gte('created_at', since);

  if (error) throw error;

  const rows = data ?? [];
  const total = rows.length;
  const lumaRegistered = rows.filter((r) => r.webinar_registered).length;
  const linkSent = rows.filter((r) => r.webinar_link_sent_at).length;
  const attended = rows.filter((r) =>
    readWebinarAttended((r.metadata as Record<string, unknown> | null) ?? {}),
  ).length;

  return {
    total_leads: total,
    luma_registered: lumaRegistered,
    registration_rate: total > 0 ? Math.round((lumaRegistered / total) * 1000) / 10 : 0,
    link_sent: linkSent,
    attended,
  };
}

export async function fetchAmbassadorRows(
  supabase: SupabaseClient,
  filter: AmbassadorFilter = 'all',
): Promise<AmbassadorRow[]> {
  let q = supabase
    .from('conversations')
    .select(
      'id, customer_phone, created_at, webinar_link_sent_at, webinar_registered, lead_country, metadata, last_message_at',
    )
    .eq('is_ambassador', true)
    .order('created_at', { ascending: false });

  if (filter === 'registered') {
    q = q.eq('webinar_registered', true);
  } else if (filter === 'unregistered') {
    q = q.eq('webinar_registered', false);
  }

  const { data: convs, error } = await q;
  if (error) throw error;
  if (!convs?.length) return [];

  const ids = convs.map((c) => c.id as string);
  const { data: msgStats, error: msgError } = await supabase
    .from('messages')
    .select('conversation_id, created_at')
    .in('conversation_id', ids);

  if (msgError) throw msgError;

  const countByConv = new Map<string, number>();
  const lastByConv = new Map<string, string>();
  for (const msg of msgStats ?? []) {
    const convId = msg.conversation_id as string;
    countByConv.set(convId, (countByConv.get(convId) ?? 0) + 1);
    const createdAt = msg.created_at as string;
    const prev = lastByConv.get(convId);
    if (!prev || createdAt > prev) lastByConv.set(convId, createdAt);
  }

  return convs.map((conv) => {
    const metadata = (conv.metadata as Record<string, unknown> | null) ?? {};
    const id = conv.id as string;
    return {
      id,
      customer_phone: conv.customer_phone as string,
      email: readMetadataString(metadata, 'customer_email', 'email'),
      name: readMetadataString(metadata, 'customer_name', 'name'),
      created_at: conv.created_at as string,
      webinar_link_sent_at: (conv.webinar_link_sent_at as string | null) ?? null,
      webinar_registered: Boolean(conv.webinar_registered),
      webinar_attended: readWebinarAttended(metadata),
      msg_count: countByConv.get(id) ?? 0,
      last_msg_at: lastByConv.get(id) ?? (conv.last_message_at as string | null),
      lead_country: (conv.lead_country as string | null) ?? null,
      metadata,
    };
  });
}

export async function markAmbassadorWebinarAttended(
  supabase: SupabaseClient,
  conversationId: string,
  attended: boolean,
): Promise<void> {
  const { data: row } = await supabase
    .from('conversations')
    .select('metadata')
    .eq('id', conversationId)
    .eq('is_ambassador', true)
    .maybeSingle();

  if (!row) throw new Error('Ambassador conversation not found');

  const metadata = {
    ...((row.metadata as Record<string, unknown> | null) ?? {}),
    webinar_attended: attended,
    webinar_attended_at: attended ? new Date().toISOString() : null,
  };

  const patch: Record<string, unknown> = { metadata };
  if (attended) patch.webinar_registered = true;

  const { error } = await supabase.from('conversations').update(patch).eq('id', conversationId);

  if (error) throw error;
}
