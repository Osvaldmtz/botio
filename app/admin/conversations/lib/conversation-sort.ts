import type { ConversationSummary } from './conversation-queries';

export function sortConversationsWithHotPriority(
  conversations: ConversationSummary[],
): ConversationSummary[] {
  return [...conversations].sort((a, b) => {
    const aHot = (a.lead_score ?? 0) >= 70;
    const bHot = (b.lead_score ?? 0) >= 70;
    if (aHot && !bHot) return -1;
    if (!aHot && bHot) return 1;
    const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return bTime - aTime;
  });
}
