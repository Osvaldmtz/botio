import 'server-only';
import { Resend } from 'resend';
import type { SupabaseClient } from '@supabase/supabase-js';
import { personalizeTemplate } from './personalize';
import type { EmailSequenceRow } from './types';

const FROM = 'Kalyo <hola@kalyo.io>';

function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('Missing RESEND_API_KEY');
  return new Resend(apiKey);
}

export async function sendSequenceEmail(params: {
  supabase: SupabaseClient;
  sequence: Pick<
    EmailSequenceRow,
    'id' | 'subject' | 'html_template' | 'name'
  >;
  to: string;
  psychologistName?: string | null;
}): Promise<{ logId: string; resendId: string | null }> {
  const { supabase, sequence, to, psychologistName } = params;
  const html = personalizeTemplate(sequence.html_template, psychologistName);
  const resend = getResend();

  const { data, error } = await resend.emails.send({
    from: FROM,
    to,
    subject: sequence.subject,
    html,
  });

  if (error) {
    throw new Error(error.message || 'Resend send failed');
  }

  const resendId = data?.id ?? null;

  const { data: log, error: logError } = await supabase
    .from('email_logs')
    .insert({
      to_email: to,
      sequence_id: sequence.id,
      resend_id: resendId,
      status: 'sent',
    })
    .select('id')
    .single();

  if (logError) throw logError;

  return { logId: log.id as string, resendId };
}
