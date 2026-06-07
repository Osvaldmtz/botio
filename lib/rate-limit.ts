import type { SupabaseClient } from '@supabase/supabase-js';

export const WINDOW_SECONDS = 60;
export const MAX_MESSAGES_PER_WINDOW = 10;
export const TEST_PHONES = ['+528127707070', '+528114112000'];

export type RateLimitResult = {
  allowed: boolean;
  current_count: number;
  reset_in_seconds: number;
  reason?: string;
};

function isTestPhone(phone: string): boolean {
  return TEST_PHONES.includes(phone);
}

function windowStartIso(): string {
  return new Date(Date.now() - WINDOW_SECONDS * 1000).toISOString();
}

async function countRecentEvents(
  supabase: SupabaseClient,
  phone: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('rate_limit_events')
    .select('id', { count: 'exact', head: true })
    .eq('customer_phone', phone)
    .gt('created_at', windowStartIso());

  if (error) throw error;
  return count ?? 0;
}

async function oldestEventResetSeconds(
  supabase: SupabaseClient,
  phone: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('rate_limit_events')
    .select('created_at')
    .eq('customer_phone', phone)
    .gt('created_at', windowStartIso())
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.created_at) return WINDOW_SECONDS;

  const expiresAt =
    new Date(data.created_at).getTime() + WINDOW_SECONDS * 1000;
  return Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000));
}

export async function checkRateLimit(
  supabase: SupabaseClient,
  phone: string,
  botId: string,
  conversationId: string | null,
): Promise<RateLimitResult> {
  if (isTestPhone(phone)) {
    return {
      allowed: true,
      current_count: 0,
      reset_in_seconds: WINDOW_SECONDS,
    };
  }

  const count = await countRecentEvents(supabase, phone);

  if (count >= MAX_MESSAGES_PER_WINDOW) {
    const resetInSeconds = await oldestEventResetSeconds(supabase, phone);

    const { error: blockError } = await supabase.from('rate_limit_blocks').insert({
      customer_phone: phone,
      bot_id: botId,
      messages_count: count,
      reason: 'rate_exceeded',
      conversation_id: conversationId,
    });

    if (blockError) {
      console.error('[rate-limit] failed to record block', blockError);
    }

    console.log(`[rate-limit] BLOCKED | phone=${phone} count=${count}`);

    return {
      allowed: false,
      current_count: count,
      reset_in_seconds: resetInSeconds,
      reason: 'rate_exceeded',
    };
  }

  const { error: insertError } = await supabase.from('rate_limit_events').insert({
    customer_phone: phone,
    bot_id: botId,
    event_type: 'message',
  });

  if (insertError) throw insertError;

  const newCount = count + 1;
  console.log(
    `[rate-limit] allowed | phone=${phone} count=${newCount}/${MAX_MESSAGES_PER_WINDOW}`,
  );

  return {
    allowed: true,
    current_count: newCount,
    reset_in_seconds: WINDOW_SECONDS,
  };
}

export async function cleanupOldRateLimitEvents(
  supabase: SupabaseClient,
): Promise<number> {
  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('rate_limit_events')
    .delete()
    .lt('created_at', cutoff)
    .select('id');

  if (error) throw error;
  return data?.length ?? 0;
}
