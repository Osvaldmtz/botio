'use client';

import type { ConversationMessage } from '../lib/conversation-queries';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';

type Props = {
  message: ConversationMessage;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';
  const isAudio = message.source === 'audio';
  const isCache = message.source_type === 'cache';
  const isHuman = message.source_type === 'human';
  const sentBy =
    typeof message.metadata?.sent_by === 'string' ? message.metadata.sent_by : null;
  const duration =
    typeof message.metadata?.duration_seconds === 'number'
      ? message.metadata.duration_seconds
      : null;

  return (
    <div className={cn('flex gap-2', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser ? (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-muted text-xs">
          S
        </div>
      ) : null}

      <div className={cn('max-w-[85%]', isUser && 'items-end')}>
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-fg-tertiary">
            {isUser ? 'Usuario' : isHuman ? `🙋 ${sentBy ?? 'Humano'}` : 'Sofía'}
          </span>
          {isAudio ? (
            <Badge tone="gray">🎙 Audio{duration !== null ? ` ${duration}s` : ''}</Badge>
          ) : null}
          {isCache ? <Badge tone="gray">⚡ Cache</Badge> : null}
        </div>

        <div
          className={cn(
            'rounded-card px-3 py-2 text-sm leading-relaxed',
            isUser
              ? 'bg-bg-subtle text-fg'
              : isHuman
                ? 'border border-semantic-warning bg-semantic-warning-bg text-fg'
                : 'border border-bg-border bg-bg text-fg',
          )}
        >
          {message.content}
        </div>

        <span className="mt-1 block text-xs text-fg-tertiary">{formatTime(message.created_at)}</span>
      </div>
    </div>
  );
}
