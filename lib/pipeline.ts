export const PIPELINE_STAGES = [
  'new',
  'in_conversation',
  'qualified',
  'trial',
  'paid',
  'lost',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const TERMINAL_STAGES: PipelineStage[] = ['paid', 'lost'];

export const STAGE_RANK: Record<PipelineStage, number> = {
  new: 0,
  in_conversation: 1,
  qualified: 2,
  trial: 3,
  paid: 4,
  lost: -1,
};

export type PipelineConversation = {
  id: string;
  pipeline_stage: PipelineStage | string | null;
  lead_captured: boolean;
  customer_phone: string;
  last_message_at: string | null;
  pipeline_stage_updated_by?: string | null;
};

export type PipelineMessage = {
  role: string;
  content: string;
  metadata?: Record<string, unknown> | null;
};

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

export function hasContactInfo(
  conversation: PipelineConversation,
  messages: PipelineMessage[],
): boolean {
  if (conversation.customer_phone?.trim()) return true;
  return messages.some((m) => m.role === 'user' && EMAIL_RE.test(m.content));
}

export function hasTrialActivated(messages: PipelineMessage[]): boolean {
  return messages.some((m) => m.metadata?.trial_activated === true);
}

export function normalizeStage(stage: string | null | undefined): PipelineStage {
  if (stage && PIPELINE_STAGES.includes(stage as PipelineStage)) {
    return stage as PipelineStage;
  }
  return 'new';
}

export function determineStage(
  conversation: PipelineConversation,
  messages: PipelineMessage[],
  userMessageCount: number,
  options?: { trialJustActivated?: boolean },
): PipelineStage | null {
  const current = normalizeStage(conversation.pipeline_stage);

  if (TERMINAL_STAGES.includes(current)) {
    return null;
  }

  let target: PipelineStage = 'new';

  if (userMessageCount >= 3) {
    target = 'in_conversation';
  }

  if (conversation.lead_captured && hasContactInfo(conversation, messages)) {
    target = 'qualified';
  }

  if (options?.trialJustActivated || hasTrialActivated(messages)) {
    target = 'trial';
  }

  if (STAGE_RANK[target] <= STAGE_RANK[current]) {
    return null;
  }

  return target;
}
