export type EmailLogStatus = 'sent' | 'opened' | 'bounced' | 'error';
export type EmailJobStatus = 'pending' | 'sent' | 'cancelled' | 'failed';

export type EmailSequence = {
  id: string;
  name: string;
  triggerTag: string;
  cancelOnTag: string | null;
  delayDays: number;
  subject: string;
  htmlTemplate: string;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type EmailLog = {
  id: string;
  to: string;
  sequenceId: string | null;
  campaignId: string | null;
  campaign: string | null;
  sequence: string;
  status: EmailLogStatus;
  sentAt: string;
  emailId: string;
  openedAt: string | null;
  errorMessage: string | null;
};

export type EmailMetrics = {
  totalSent: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  bySequence: Array<{
    sequenceId: string;
    sequence: string;
    sent: number;
    opened: number;
    clicked: number;
    bounced: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
  }>;
};

export type EmailSequenceRow = {
  id: string;
  name: string;
  trigger_tag: string;
  cancel_on_tag: string | null;
  delay_days: number;
  subject: string;
  html_template: string;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type EmailLogRow = {
  id: string;
  to_email: string;
  sequence_id: string | null;
  campaign_id?: string | null;
  campaign_name?: string | null;
  error_message?: string | null;
  resend_id: string | null;
  status: EmailLogStatus;
  sent_at: string;
  opened_at: string | null;
  clicked_at: string | null;
  created_at: string;
  email_sequences?: { name: string } | null;
};
