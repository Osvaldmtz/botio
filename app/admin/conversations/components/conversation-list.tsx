'use client';

import type { ConversationSummary } from '../lib/conversation-queries';
import { ConversationCard } from './conversation-card';

type Props = {
  conversations: ConversationSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function ConversationList({ conversations, selectedId, onSelect }: Props) {
  if (conversations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-bg-border p-8 text-center">
        <p className="text-sm text-fg-muted">No hay conversaciones con estos filtros.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {conversations.map((conversation) => (
        <ConversationCard
          key={conversation.id}
          conversation={conversation}
          selected={selectedId === conversation.id}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
