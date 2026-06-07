'use client';

import type { ConversationMessage } from '../lib/conversation-queries';

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
    <div className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[85%] flex flex-col gap-1 ${isUser ? '' : 'items-end'}`}>
        <div className="flex flex-wrap items-center gap-2 px-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-fg-muted">
            {isUser ? 'Usuario' : isHuman ? `Humano${sentBy ? ` · ${sentBy}` : ''}` : 'Bot'}
          </span>
          {isAudio ? (
            <span className="rounded-full border border-electric/30 bg-electric/10 px-2 py-0.5 text-[10px] text-electric">
              🎙 Audio{duration !== null ? ` · ${duration}s` : ''}
            </span>
          ) : null}
          {isCache ? (
            <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] text-accent">
              ⚡ Cache
            </span>
          ) : null}
          {isHuman ? (
            <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] text-orange-300">
              🙋 Handoff
            </span>
          ) : null}
        </div>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed text-fg ${
            isUser
              ? 'rounded-tl-sm border border-bg-border bg-bg-elevated'
              : isHuman
                ? 'rounded-tr-sm border border-orange-500/20 bg-orange-500/10'
                : 'rounded-tr-sm bg-accent/15'
          }`}
        >
          {message.content}
        </div>
        <span className="px-1 text-[11px] text-fg-muted">{formatTime(message.created_at)}</span>
      </div>
    </div>
  );
}
