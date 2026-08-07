import 'server-only';
import { Resend } from 'resend';
import type { SupabaseClient } from '@supabase/supabase-js';
import { personalizeTemplate } from './personalize';
import {
  fetchSegmentContacts,
  isEmailSegmentId,
  type EmailSegmentId,
} from './segments';
import { WELCOME_UNSUBSCRIBE_HEADERS } from './templates/welcome-transactional';

export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'sending'
  | 'sent'
  | 'failed';

export type EmailCampaign = {
  id: string;
  name: string;
  subject: string;
  htmlBody: string;
  segment: EmailSegmentId;
  status: CampaignStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type CampaignRow = {
  id: string;
  name: string;
  subject: string;
  html_body: string;
  segment: string;
  status: CampaignStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapCampaign(row: CampaignRow): EmailCampaign {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    htmlBody: row.html_body,
    segment: row.segment as EmailSegmentId,
    status: row.status,
    scheduledAt: row.scheduled_at,
    sentAt: row.sent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('Missing RESEND_API_KEY');
  return new Resend(apiKey);
}

export async function listCampaigns(
  supabase: SupabaseClient,
): Promise<EmailCampaign[]> {
  const { data, error } = await supabase
    .from('email_campaigns')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as CampaignRow[]).map(mapCampaign);
}

export async function getCampaign(
  supabase: SupabaseClient,
  id: string,
): Promise<EmailCampaign | null> {
  const { data, error } = await supabase
    .from('email_campaigns')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapCampaign(data as CampaignRow);
}

export async function createCampaign(
  supabase: SupabaseClient,
  input: {
    name: string;
    subject: string;
    htmlBody: string;
    segment: string;
    scheduledAt?: string | null;
  },
): Promise<EmailCampaign> {
  if (!isEmailSegmentId(input.segment)) {
    throw new Error('Invalid segment');
  }
  const { data, error } = await supabase
    .from('email_campaigns')
    .insert({
      name: input.name.trim(),
      subject: input.subject.trim(),
      html_body: input.htmlBody,
      segment: input.segment,
      status: 'draft',
      scheduled_at: input.scheduledAt ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapCampaign(data as CampaignRow);
}

export async function updateCampaign(
  supabase: SupabaseClient,
  id: string,
  input: Partial<{
    name: string;
    subject: string;
    htmlBody: string;
    segment: string;
    scheduledAt: string | null;
    status: CampaignStatus;
  }>,
): Promise<EmailCampaign> {
  const update: Record<string, unknown> = {};
  if (input.name !== undefined) update.name = input.name.trim();
  if (input.subject !== undefined) update.subject = input.subject.trim();
  if (input.htmlBody !== undefined) update.html_body = input.htmlBody;
  if (input.segment !== undefined) {
    if (!isEmailSegmentId(input.segment)) throw new Error('Invalid segment');
    update.segment = input.segment;
  }
  if (input.scheduledAt !== undefined) update.scheduled_at = input.scheduledAt;
  if (input.status !== undefined) update.status = input.status;

  const { data, error } = await supabase
    .from('email_campaigns')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapCampaign(data as CampaignRow);
}

export async function sendCampaignTest(params: {
  to: string;
  subject: string;
  htmlBody: string;
  psychologistName?: string;
}): Promise<{ resendId: string | null }> {
  const resend = getResend();
  const html = personalizeTemplate(params.htmlBody, params.psychologistName);
  const { data, error } = await resend.emails.send({
    from: 'Sofía de Kalyo <hola@kalyo.io>',
    to: params.to.trim().toLowerCase(),
    subject: params.subject,
    html,
    headers: { ...WELCOME_UNSUBSCRIBE_HEADERS },
  });
  if (error) throw new Error(error.message || 'Resend send failed');
  return { resendId: data?.id ?? null };
}

export async function executeCampaignSend(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<{ sent: number; failed: number }> {
  const campaign = await getCampaign(supabase, campaignId);
  if (!campaign) throw new Error('Campaign not found');

  await updateCampaign(supabase, campaignId, { status: 'sending' });

  const contacts = await fetchSegmentContacts(campaign.segment);
  const resend = getResend();
  let sent = 0;
  let failed = 0;

  for (const contact of contacts) {
    try {
      const html = personalizeTemplate(campaign.htmlBody, contact.name);
      const { data, error } = await resend.emails.send({
        from: 'Sofía de Kalyo <hola@kalyo.io>',
        to: contact.email,
        subject: campaign.subject,
        html,
        headers: { ...WELCOME_UNSUBSCRIBE_HEADERS },
      });

      if (error) throw new Error(error.message);

      await supabase.from('email_logs').insert({
        to_email: contact.email,
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        sequence_id: null,
        resend_id: data?.id ?? null,
        status: 'sent',
      });
      sent += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await supabase.from('email_logs').insert({
        to_email: contact.email,
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        sequence_id: null,
        status: 'error',
        error_message: message,
      });
      failed += 1;
    }
  }

  await supabase
    .from('email_campaigns')
    .update({
      status: failed > 0 && sent === 0 ? 'failed' : 'sent',
      sent_at: new Date().toISOString(),
    })
    .eq('id', campaignId);

  return { sent, failed };
}

export async function processScheduledCampaigns(
  supabase: SupabaseClient,
): Promise<{ processed: number }> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('email_campaigns')
    .select('id')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)
    .limit(10);

  if (error) throw error;

  let processed = 0;
  for (const row of data ?? []) {
    await executeCampaignSend(supabase, row.id as string);
    processed += 1;
  }
  return { processed };
}
