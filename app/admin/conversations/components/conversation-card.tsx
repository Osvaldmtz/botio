'use client';

import { MapPin } from 'lucide-react';
import type { ConversationSummary } from '../lib/conversation-queries';
import { channelBadge } from '@/lib/channel-utils';
import { Badge } from '@/components/ui/badge';
import {
  avatarLabel,
  conversationStatus,
  extractLeadName,
  formatRelativeTime,
  isHotLead,
  isNewHotLead,
  statusToneToBadge,
  temperatureBadge,
  truncate,
} from '../lib/format';
import { cn } from '@/lib/cn';

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
  const hot = isHotLead(conversation.lead_score);
  const hotNew = isNewHotLead(conversation.created_at, conversation.lead_score);
  const hotWithoutMessages = hot && conversation.message_count === 0;

  return (
    <button
      type="button"
      onClick={() => onSelect(conversation.id)}
      className={cn(
        'conversation-card w-full rounded-card border px-4 py-3 text-left transition-colors duration-150',
        hot && 'border-l-4 border-l-semantic-hot',
        hotNew && 'hot-new',
        selected
          ? 'border-accent bg-accent-muted/30'
          : 'border-bg-border bg-bg hover:bg-bg-elevated hover:border-bg-border-hover',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-subtle text-sm font-medium text-fg-muted">
          {avatarLabel(conversation.customer_phone, conversation.lead_temperature)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-medium text-fg">{title}</h3>
            <Badge tone={channel.tone}>
              {channel.emoji} {channel.label}
            </Badge>
            {hot ? (
              <Badge tone="hot">🔥 HOT{conversation.lead_score !== null ? ` ${conversation.lead_score}` : ''}</Badge>
            ) : null}
            {hotWithoutMessages ? (
              <Badge tone="warning">⚠️ Sin mensajes (posible test)</Badge>
            ) : null}
            {!hot && temp ? (
              <Badge tone={temp.tone === 'hot' ? 'hot' : temp.tone === 'warm' ? 'warning' : 'gray'}>
                {temp.label}
                {conversation.lead_score !== null ? ` ${conversation.lead_score}` : ''}
              </Badge>
            ) : null}
            {conversation.lead_city ? (
              <span className="inline-flex items-center gap-0.5 text-xs text-fg-muted">
                <MapPin className="h-3 w-3" strokeWidth={1.5} />
                {conversation.lead_city}
              </span>
            ) : null}
          </div>

          <p className="mt-1 line-clamp-1 text-sm text-fg-muted">
            {truncate(conversation.last_message_content, 120)}
          </p>

          <p className="mt-1.5 text-xs text-fg-tertiary">
            {conversation.message_count} msgs · {conversation.bot_name}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="text-xs font-medium tabular-nums text-fg-muted">
            {formatRelativeTime(conversation.last_message_at)}
          </span>
          {conversation.handoff_active ? (
            <Badge tone="warning">Handoff</Badge>
          ) : (
            <Badge tone={statusToneToBadge(status.tone)}>{status.label}</Badge>
          )}
          {conversation.needs_reply && !conversation.handoff_active ? (
            <span className="h-2 w-2 rounded-full bg-semantic-hot" />
          ) : null}
        </div>
      </div>
    </button>
  );
}
