'use client';

import { useState, type KeyboardEvent } from 'react';
import { extractLeadName } from '../lib/format';
import type { ConversationDetail } from '../lib/conversation-queries';

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
    <section className="rounded-xl border border-orange-500/30 bg-bg-elevated p-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-orange-300">
        Responder por WhatsApp
      </h3>
      {sentFlash ? (
        <p className="mb-2 text-xs text-accent">✓ Mensaje enviado por WhatsApp</p>
      ) : null}
      {error ? <p className="mb-2 text-xs text-red-300">{error}</p> : null}
      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          disabled={sending}
          placeholder={`Escribe tu mensaje a ${recipient}...`}
          className="min-h-[72px] flex-1 resize-none rounded-lg border border-bg-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-orange-500/50 focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => void sendMessage()}
          disabled={sending || !text.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-lg bg-orange-500 text-bg transition-opacity hover:bg-orange-400 disabled:opacity-40"
          title="Enviar"
        >
          {sending ? '…' : '➤'}
        </button>
      </div>
      <p className="mt-1 text-[10px] text-fg-muted">Enter envía · Shift+Enter nueva línea</p>
    </section>
  );
}
