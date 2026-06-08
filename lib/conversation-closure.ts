import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { movePipelineStage } from '@/lib/pipeline-utils';
import { resolvePipelineStageOnClosure } from '@/lib/pipeline-stages';
import {
  type ClosureReason,
  formatClosureLabel,
  isClosureReason,
  CLOSURE_REASONS,
  CLOSURE_REASON_UI,
} from '@/lib/conversation-closure-constants';

export {
  CLOSURE_REASONS,
  CLOSURE_REASON_UI,
  formatClosureLabel,
  isClosureReason,
  type ClosureReason,
};

async function notifyConversionTelegram(params: {
  customerPhone: string;
  note?: string | null;
}): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) return;

  const text =
    `🎉 <b>Conversión confirmada</b>\n\n` +
    `Cliente: ${params.customerPhone}\n` +
    (params.note?.trim() ? `Nota: ${params.note.trim()}` : '');

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
}

export async function closeConversationWithReason(
  supabase: SupabaseClient,
  conversationId: string,
  params: { reason: ClosureReason; note?: string | null },
): Promise<Record<string, unknown>> {
  const now = new Date().toISOString();
  const note = params.note?.trim() || null;

  const { data: existing, error: fetchError } = await supabase
    .from('conversations')
    .select('id, pipeline_stage, customer_phone')
    .eq('id', conversationId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!existing) throw new Error('Not found');

  const { data, error } = await supabase
    .from('conversations')
    .update({
      is_closed: true,
      closed_at: now,
      closure_reason: params.reason,
      closure_note: note,
      closed_by: 'admin',
    })
    .eq('id', conversationId)
    .select('*')
    .single();

  if (error) throw error;

  const targetStage = resolvePipelineStageOnClosure(params.reason);
  if (targetStage) {
    await movePipelineStage(
      supabase,
      conversationId,
      existing.pipeline_stage,
      targetStage,
      'admin',
      'manual',
    );
  }

  if (params.reason === 'converted') {
    try {
      await notifyConversionTelegram({
        customerPhone: existing.customer_phone as string,
        note,
      });
    } catch (err) {
      console.error('[admin] conversion telegram failed', err);
    }
  }

  console.log(
    `[admin] conversation closed | id=${conversationId} | reason=${params.reason}`,
  );

  return data as Record<string, unknown>;
}

export async function reopenConversation(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from('conversations')
    .update({
      is_closed: false,
      closed_at: null,
      closure_reason: null,
      closure_note: null,
      closed_by: null,
      close_reason: null,
    })
    .eq('id', conversationId)
    .select('*')
    .single();

  if (error) throw error;

  console.log(`[admin] conversation reopened | id=${conversationId}`);

  return data as Record<string, unknown>;
}
