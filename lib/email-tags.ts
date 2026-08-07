import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendSequenceEmail } from '@/lib/emailing/send';
import type { EmailSequenceRow } from '@/lib/emailing/types';

/**
 * Trigger email sequences from Kalyo backend events.
 *
 * Examples:
 *   await triggerEmailSequence(user.email, 'trial-activo', user.name)
 *   await triggerEmailSequence(user.email, 'onboarding-paso-1', user.name)
 */
export async function triggerEmailSequence(
  userEmail: string,
  tag: string,
  psychologistName?: string,
): Promise<{
  sent: number;
  queued: number;
  cancelled: number;
}> {
  const email = userEmail.trim().toLowerCase();
  if (!email || !tag.trim()) {
    throw new Error('userEmail and tag are required');
  }

  const supabase = createAdminClient();
  let sent = 0;
  let queued = 0;
  let cancelled = 0;

  if (tag === 'trial-convertido') {
    const { data } = await supabase
      .from('email_jobs')
      .update({ status: 'cancelled', error: 'Cancelled: trial-convertido' })
      .eq('to_email', email)
      .eq('status', 'pending')
      .select('id');
    cancelled += data?.length ?? 0;
    return { sent, queued, cancelled };
  }

  // Cancel delayed nudges when the user completes the related step
  const { data: cancelTargets } = await supabase
    .from('email_sequences')
    .select('id')
    .eq('cancel_on_tag', tag);

  const cancelIds = (cancelTargets ?? []).map((r) => r.id as string);
  if (cancelIds.length > 0) {
    const { data } = await supabase
      .from('email_jobs')
      .update({ status: 'cancelled', error: `Cancelled: ${tag}` })
      .eq('to_email', email)
      .eq('status', 'pending')
      .in('sequence_id', cancelIds)
      .select('id');
    cancelled += data?.length ?? 0;
  }

  const { data: sequences, error } = await supabase
    .from('email_sequences')
    .select('*')
    .eq('trigger_tag', tag)
    .eq('active', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;

  for (const sequence of (sequences ?? []) as EmailSequenceRow[]) {
    if (sequence.delay_days <= 0) {
      await sendSequenceEmail({
        supabase,
        sequence,
        to: email,
        psychologistName,
      });
      sent += 1;
      continue;
    }

    const runAt = new Date();
    runAt.setDate(runAt.getDate() + sequence.delay_days);

    const { error: jobError } = await supabase.from('email_jobs').insert({
      to_email: email,
      sequence_id: sequence.id,
      psychologist_name: psychologistName ?? null,
      run_at: runAt.toISOString(),
      status: 'pending',
    });

    if (jobError) throw jobError;
    queued += 1;
  }

  return { sent, queued, cancelled };
}
