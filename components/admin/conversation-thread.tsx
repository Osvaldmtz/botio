type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

type Props = {
  messages: Message[];
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('es-MX', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ConversationThread({ messages }: Props) {
  if (messages.length === 0) {
    return <p className="text-sm text-fg-muted">No messages in this conversation.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {messages.map((msg) => {
        const isUser = msg.role === 'user';
        return (
          <div key={msg.id} className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[75%] flex flex-col gap-1 ${isUser ? '' : 'items-end'}`}>
              <div
                className={`rounded-2xl px-4 py-2 text-sm text-fg ${
                  isUser ? 'rounded-tl-sm bg-bg-elevated' : 'rounded-tr-sm bg-accent/20'
                }`}
              >
                {msg.content}
              </div>
              <span className="px-1 text-xs text-fg-muted">{formatTime(msg.created_at)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
