'use client';

import { useState, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { extractLeadName } from '../lib/format';
import type { ConversationDetail } from '../lib/conversation-queries';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

type Props = {
  detail: ConversationDetail;
  adminName: string;
  onSent: () => void;
};

export function HandoffChatBox({ detail, adminName, onSent }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentFlash, setSentFlash] = useState(false);

  const recipient = extractLeadName(detail.customer_phone, detail.lead_signals);

  async function sendMessage() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/conversations/${detail.id}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed, sent_by: adminName }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      setText('');
      setSentFlash(true);
      setTimeout(() => setSentFlash(false), 2000);
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  return (
    <section className="rounded-card border border-bg-border bg-bg p-4">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-fg-tertiary">
        Responder manualmente
      </h3>
      {sentFlash ? (
        <p className="mb-2 text-xs text-accent-muted-fg">✓ Mensaje enviado</p>
      ) : null}
      {error ? <p className="mb-2 text-xs text-semantic-hot">{error}</p> : null}
      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          disabled={sending}
          placeholder={`Escribe tu mensaje a ${recipient}...`}
          className={cn(
            'min-h-[72px] flex-1 resize-none rounded border border-bg-border bg-bg px-3 py-2 text-sm text-fg',
            'placeholder:text-fg-tertiary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-muted disabled:opacity-50',
          )}
        />
        <Button
          size="sm"
          className="self-end"
          onClick={() => void sendMessage()}
          disabled={sending || !text.trim()}
        >
          <Send className="h-4 w-4" strokeWidth={1.5} />
        </Button>
      </div>
      <p className="mt-2 text-xs text-fg-tertiary">Enter envía · Shift+Enter nueva línea</p>
    </section>
  );
}
