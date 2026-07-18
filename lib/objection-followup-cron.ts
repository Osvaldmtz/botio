import type { SupabaseClient } from '@supabase/supabase-js';
import type { TwilioCreds, SendWhatsAppFn } from '@/lib/trial-onboarding-cron';
import { holaName, renderName } from '@/lib/render-name';

export type ObjectionFollowupRow = {
  id: string;
  conversation_id: string | null;
  customer_phone: string;
  customer_email: string | null;
  objection_type: string;
  trigger_message: string;
};

const ROW_SELECT = 'id, conversation_id, customer_phone, customer_email, objection_type, trigger_message';

function detectedAtWindow(minHoursAgo: number, maxHoursAgo: number): { from: string; to: string } {
  const now = Date.now();
  return {
    from: new Date(now - maxHoursAgo * 60 * 60 * 1000).toISOString(),
    to: new Date(now - minHoursAgo * 60 * 60 * 1000).toISOString(),
  };
}

function displayName(row: ObjectionFollowupRow): string {
  return renderName(row.customer_email?.split('@')[0]);
}

export async function fetchThinkingFollowups(
  supabase: SupabaseClient,
): Promise<ObjectionFollowupRow[]> {
  const { from, to } = detectedAtWindow(70, 74);
  const { data, error } = await supabase
    .from('detected_objections')
    .select(ROW_SELECT)
    .eq('objection_type', 'thinking')
    .eq('outcome', 'pending')
    .gte('detected_at', from)
    .lte('detected_at', to);

  if (error) throw error;
  return (data ?? []) as ObjectionFollowupRow[];
}

export async function fetchNoTimeFollowups(
  supabase: SupabaseClient,
): Promise<ObjectionFollowupRow[]> {
  const { from, to } = detectedAtWindow(166, 170);
  const { data, error } = await supabase
    .from('detected_objections')
    .select(ROW_SELECT)
    .eq('objection_type', 'no_time')
    .eq('outcome', 'pending')
    .gte('detected_at', from)
    .lte('detected_at', to);

  if (error) throw error;
  return (data ?? []) as ObjectionFollowupRow[];
}

function formatThinkingFollowup(name: string): string {
  return (
    `${holaName(name)} te escribo siguiendo nuestra conversación. ¿Lograste pensarlo? ` +
    `Si tienes preguntas sobre Kalyo, aquí estoy.`
  );
}

function formatNoTimeFollowup(name: string): string {
  return (
    `${holaName(name)} espero estés mejor de tiempo. Solo pasaba a recordarte que Kalyo sigue aquí ` +
    `cuando quieras probarlo (trial gratis 7 días). ¿Te interesa?`
  );
}

async function sendFollowup(params: {
  supabase: SupabaseClient;
  creds: TwilioCreds;
  row: ObjectionFollowupRow;
  body: string;
  sendFn: SendWhatsAppFn;
}): Promise<boolean> {
  try {
    await params.sendFn({
      accountSid: params.creds.accountSid,
      authToken: params.creds.authToken,
      from: params.creds.from,
      to: params.row.customer_phone,
      body: params.body,
    });

    await params.supabase
      .from('detected_objections')
      .update({
        outcome: 'follow_up_sent',
        resolved_at: new Date().toISOString(),
      })
      .eq('id', params.row.id);

    if (params.row.conversation_id) {
      await params.supabase.from('messages').insert({
        conversation_id: params.row.conversation_id,
        role: 'assistant',
        content: params.body,
        source: 'text',
        source_type: 'claude',
        metadata: { source: 'objection_followup' },
      });
    }

    console.log(
      `[objection-followup] sent | type=${params.row.objection_type} | phone=${params.row.customer_phone}`,
    );
    return true;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(
      `[objection-followup] failed | id=${params.row.id} | error=${error}`,
    );
    return false;
  }
}

export type ObjectionFollowupSummary = {
  sent_thinking: number;
  sent_no_time: number;
  failed: number;
  pending_thinking: number;
  pending_no_time: number;
};

export async function runObjectionFollowupCron(params: {
  supabase: SupabaseClient;
  creds: TwilioCreds;
  sendFn?: SendWhatsAppFn;
}): Promise<ObjectionFollowupSummary> {
  console.log('[objection-followup] cron started');

  const { sendWhatsApp } = await import('@/lib/twilio');
  const sendFn =
    params.sendFn ??
    (async (args) => {
      await sendWhatsApp(args);
    });

  const thinking = await fetchThinkingFollowups(params.supabase);
  const noTime = await fetchNoTimeFollowups(params.supabase);

  console.log(`[objection-followup] found ${thinking.length} thinking followups`);
  console.log(`[objection-followup] found ${noTime.length} no_time followups`);

  let sentThinking = 0;
  let sentNoTime = 0;
  let failed = 0;

  for (const row of thinking) {
    const name = displayName(row);
    const ok = await sendFollowup({
      supabase: params.supabase,
      creds: params.creds,
      row,
      body: formatThinkingFollowup(name),
      sendFn,
    });
    if (ok) sentThinking += 1;
    else failed += 1;
  }

  for (const row of noTime) {
    const name = displayName(row);
    const ok = await sendFollowup({
      supabase: params.supabase,
      creds: params.creds,
      row,
      body: formatNoTimeFollowup(name),
      sendFn,
    });
    if (ok) sentNoTime += 1;
    else failed += 1;
  }

  return {
    sent_thinking: sentThinking,
    sent_no_time: sentNoTime,
    failed,
    pending_thinking: thinking.length,
    pending_no_time: noTime.length,
  };
}
