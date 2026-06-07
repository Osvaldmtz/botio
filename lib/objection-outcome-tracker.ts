import type { SupabaseClient } from '@supabase/supabase-js';
import { matchObjectionPattern } from '@/lib/objection-detector';

const CONVERTED_RE =
  /^(?:s[ií]|si|yes|ok|dale|de\s+acuerdo|quiero|me\s*anima|activa(?:me)?|vamos)$/i;
const PAY_INTENT_RE =
  /quiero\s+pagar|link\s+de\s+pago|activar\s+(?:el\s+)?(?:plan\s+)?pro|me\s*suscribo/i;
const HANDOFF_RE =
  /human[oa]|asesor|hablar\s+con\s+(?:alguien|osvaldo)|contacto\s+manual|equipo/i;

type PendingObjection = {
  id: string;
  objection_type: string;
  detected_at: string;
  outcome: string | null;
};

function classifyOutcome(
  reply: string,
  objectionType: string,
): 'converted' | 'still_objecting' | 'handoff' | 'pending' {
  const trimmed = reply.trim();
  if (!trimmed) return 'pending';

  if (HANDOFF_RE.test(trimmed)) return 'handoff';
  if (CONVERTED_RE.test(trimmed) || PAY_INTENT_RE.test(trimmed)) return 'converted';

  const newObjection = matchObjectionPattern(trimmed);
  if (newObjection) return 'still_objecting';

  if (objectionType === 'not_useful' && /no|gracias|no\s+me\s+interesa/i.test(trimmed)) {
    return 'still_objecting';
  }

  return 'pending';
}

export async function trackObjectionOutcome(
  supabase: SupabaseClient,
  conversationId: string,
  newMessage: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('detected_objections')
    .select('id, objection_type, detected_at, outcome')
    .eq('conversation_id', conversationId)
    .or('outcome.is.null,outcome.eq.pending')
    .order('detected_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return;

  const row = data as PendingObjection;
  const hoursSince =
    (Date.now() - new Date(row.detected_at).getTime()) / (60 * 60 * 1000);

  if (hoursSince > 48 && !newMessage.trim()) {
    await supabase
      .from('detected_objections')
      .update({
        outcome: 'no_response',
        resolved_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    return;
  }

  const outcome = classifyOutcome(newMessage, row.objection_type);

  const update: Record<string, unknown> = {
    customer_replied: true,
    customer_reply: newMessage,
  };

  if (outcome !== 'pending') {
    update.outcome = outcome;
    update.resolved_at = new Date().toISOString();
  }

  await supabase.from('detected_objections').update(update).eq('id', row.id);

  if (outcome !== 'pending') {
    console.log(
      `[objection-outcome] conv=${conversationId} | type=${row.objection_type} | outcome=${outcome}`,
    );
  }
}
