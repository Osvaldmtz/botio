import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendSequenceEmail } from './send';
import type { EmailSequenceRow } from './types';

const BATCH_SIZE = 50;

export async function processDueEmailJobs(supabase: SupabaseClient): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  const now = new Date().toISOString();

  const { data: jobs, error } = await supabase
    .from('email_jobs')
    .select('id, to_email, sequence_id, psychologist_name')
    .eq('status', 'pending')
    .lte('run_at', now)
    .order('run_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) throw error;

  let sent = 0;
  let failed = 0;

  for (const job of jobs ?? []) {
    const { data: sequence, error: seqError } = await supabase
      .from('email_sequences')
      .select('id, subject, html_template, name, active')
      .eq('id', job.sequence_id)
      .maybeSingle();

    if (seqError || !sequence || !sequence.active) {
      await supabase
        .from('email_jobs')
        .update({
          status: 'cancelled',
          error: seqError?.message ?? 'Sequence inactive or missing',
        })
        .eq('id', job.id);
      continue;
    }

    try {
      await sendSequenceEmail({
        supabase,
        sequence: sequence as Pick<
          EmailSequenceRow,
          'id' | 'subject' | 'html_template' | 'name'
        >,
        to: job.to_email as string,
        psychologistName: job.psychologist_name as string | null,
      });

      await supabase
        .from('email_jobs')
        .update({ status: 'sent', error: null })
        .eq('id', job.id);
      sent += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await supabase
        .from('email_jobs')
        .update({ status: 'failed', error: message })
        .eq('id', job.id);
      failed += 1;
    }
  }

  return {
    processed: (jobs ?? []).length,
    sent,
    failed,
  };
}
