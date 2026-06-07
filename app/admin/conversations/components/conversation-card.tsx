'use client';

import type { ConversationSummary } from '../lib/conversation-queries';
import { channelBadge } from '@/lib/channel-utils';
import {
  avatarLabel,
  conversationStatus,
  extractLeadName,
  formatRelativeTime,
  temperatureBadge,
  truncate,
} from '../lib/format';

type Props = {
  conversation: ConversationSummary;
  selected: boolean;
  onSelect: (id: string) => void;
};

export function ConversationCard({ conversation, selected, onSelect }: Props) {
  const status = conversationStatus(conversation);
  const temp = temperatureBadge(conversation.lead_temperature);
  const channel = channelBadge(conversation.channel);
  const title = extractLeadName(conversation.customer_phone, conversation.lead_signals);
  const showPhoneSubtitle = title !== conversation.customer_phone;

  return (
    <button
      type="button"
      onClick={() => onSelect(conversation.id)}
      className={`w-full rounded-xl border p-4 text-left transition-colors ${
        selected
          ? 'border-accent/50 bg-accent/5'
          : 'border-bg-border bg-bg-elevated hover:border-fg-muted/30'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-bg-border bg-bg text-sm font-semibold">
          {avatarLabel(conversation.customer_phone, conversation.lead_temperature)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-medium text-fg">{title}</h3>
            {conversation.lead_city ? (
              <span className="text-xs text-fg-muted">📍 {conversation.lead_city}</span>
            ) : null}
          </div>

          {showPhoneSubtitle ? (
            <p className="mt-0.5 font-mono text-xs text-fg-muted">{conversation.customer_phone}</p>
          ) : null}
          {conversation.lead_intent ? (
            <p className="mt-1 text-xs text-fg-muted">Intent: {conversation.lead_intent}</p>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${channel.className}`}
            >
              {channel.emoji} {channel.label}
            </span>

            {temp ? (
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${temp.className}`}
              >
                {temp.label}
                {conversation.lead_score !== null ? ` · ${conversation.lead_score}` : ''}
              </span>
            ) : conversation.lead_score !== null ? (
              <span className="rounded-full border border-bg-border px-2 py-0.5 text-[10px] text-fg-muted">
                Score {conversation.lead_score}
              </span>
            ) : null}

            {conversation.handoff_active ? (
              <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-medium text-orange-300">
                🙋 Handoff
                {conversation.handoff_taken_by
                  ? ` · ${conversation.handoff_taken_by}`
                  : ''}
              </span>
            ) : (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  status.tone === 'unanswered'
                    ? 'bg-red-500/15 text-red-300'
                    : status.tone === 'closed'
                      ? 'bg-bg-border text-fg-muted'
                      : 'bg-accent/10 text-accent'
                }`}
              >
                {status.label}
              </span>
            )}

            <span className="text-[10px] text-fg-muted">
              {conversation.message_count} msgs · {formatRelativeTime(conversation.last_message_at)}
            </span>
          </div>

          <p className="mt-2 line-clamp-2 text-sm text-fg-muted">
            {truncate(conversation.last_message_content, 100)}
          </p>

          <p className="mt-1 text-[11px] text-fg-muted">{conversation.bot_name}</p>
        </div>
      </div>
    </button>
  );
}
