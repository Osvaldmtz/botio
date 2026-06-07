'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConversationDetail } from '../lib/conversation-queries';
import { channelBadge, formatCustomerIdentifier } from '@/lib/channel-utils';
import {
  conversationStatus,
  extractLeadName,
  formatRelativeTime,
  isHandoffActive,
  temperatureBadge,
  whatsAppUrl,
} from '../lib/format';
import { MessageBubble } from './message-bubble';
import { HandoffControls, getHandoffAdminName } from './handoff-controls';
import { HandoffChatBox } from './handoff-chat-box';

type Props = {
  conversationId: string | null;
  onClose: () => void;
  onHandoffChange?: () => void;
};

export function ConversationDetailPanel({
  conversationId,
  onClose,
  onHandoffChange,
}: Props) {
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadDetail = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/conversations/${id}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setDetail(data.conversation);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!conversationId) {
      setDetail(null);
      return;
    }
    void loadDetail(conversationId);
  }, [conversationId, loadDetail]);

  useEffect(() => {
    if (!conversationId || !isHandoffActive(detail)) return;
    const interval = setInterval(() => {
      void loadDetail(conversationId);
    }, 10_000);
    return () => clearInterval(interval);
  }, [conversationId, detail?.handoff_active, loadDetail]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [detail?.messages.length]);

  function handleUpdated() {
    if (conversationId) void loadDetail(conversationId);
    onHandoffChange?.();
  }

  if (!conversationId) return null;

  const status = detail ? conversationStatus(detail) : null;
  const temp = detail ? temperatureBadge(detail.lead_temperature) : null;
  const channel = detail ? channelBadge(detail.channel) : null;

  async function copyPhone() {
    if (!detail?.customer_phone) return;
    await navigator.clipboard.writeText(detail.customer_phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        onClick={onClose}
        aria-hidden
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex h-screen max-h-screen w-full max-w-md min-h-0 flex-col border-l border-bg-border bg-bg shadow-2xl lg:static lg:z-0 lg:max-w-lg lg:shadow-none">
        <header className="flex items-center justify-between border-b border-bg-border px-4 py-3">
          <div>
            <h2 className="font-semibold text-fg">Detalle</h2>
            {detail ? (
              <p className="font-mono text-xs text-fg-muted">{detail.customer_phone}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-bg-border px-2 py-1 text-sm text-fg-muted hover:text-fg"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading && !detail ? (
            <p className="p-4 text-sm text-fg-muted">Cargando conversación…</p>
          ) : error ? (
            <p className="p-4 text-sm text-red-300">{error}</p>
          ) : detail ? (
            <div className="space-y-4 p-4">
              <HandoffControls detail={detail} onUpdated={handleUpdated} />

              {isHandoffActive(detail) ? (
                <HandoffChatBox
                  detail={detail}
                  adminName={getHandoffAdminName()}
                  onSent={handleUpdated}
                />
              ) : null}

              <section className="rounded-xl border border-bg-border bg-bg-elevated p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
                  Lead
                </h3>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-fg-muted">Contacto</dt>
                    <dd className="text-right text-fg">
                      {extractLeadName(detail.customer_phone, detail.lead_signals)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-fg-muted">Canal</dt>
                    <dd>
                      {channel ? (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs ${channel.className}`}
                        >
                          {channel.emoji} {channel.label}
                        </span>
                      ) : (
                        '—'
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-fg-muted">Identificador</dt>
                    <dd className="font-mono text-fg">
                      {formatCustomerIdentifier(detail.customer_phone, detail.channel)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-fg-muted">Bot</dt>
                    <dd className="text-fg">{detail.bot_name}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-fg-muted">Estado</dt>
                    <dd className="text-fg">{status?.label}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-fg-muted">Score</dt>
                    <dd className="text-fg">{detail.lead_score ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-fg-muted">Temperatura</dt>
                    <dd>
                      {temp ? (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs ${temp.className}`}
                        >
                          {temp.label}
                        </span>
                      ) : (
                        '—'
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-fg-muted">Intención</dt>
                    <dd className="text-right text-fg">{detail.lead_intent ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-fg-muted">Ciudad</dt>
                    <dd className="text-fg">{detail.lead_city ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-fg-muted">País</dt>
                    <dd className="text-fg">{detail.lead_country ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-fg-muted">Lead capturado</dt>
                    <dd className="text-fg">{detail.lead_captured ? 'Sí' : 'No'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-fg-muted">Último mensaje</dt>
                    <dd className="text-fg">{formatRelativeTime(detail.last_message_at)}</dd>
                  </div>
                </dl>

                {detail.lead_signals?.length ? (
                  <div className="mt-3">
                    <p className="text-xs text-fg-muted">Señales</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {detail.lead_signals.map((signal) => (
                        <span
                          key={signal}
                          className="rounded-full border border-bg-border px-2 py-0.5 text-[10px] text-fg-muted"
                        >
                          {signal}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={copyPhone}
                    className="rounded-lg border border-bg-border px-3 py-1.5 text-xs text-fg-muted hover:text-fg"
                  >
                    {copied ? '✓ Copiado' : 'Copiar teléfono'}
                  </button>
                  {(detail.channel ?? 'whatsapp') === 'whatsapp' ? (
                    <a
                      href={whatsAppUrl(detail.customer_phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs text-accent hover:bg-accent/20"
                    >
                      Abrir WhatsApp
                    </a>
                  ) : null}
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-muted">
                  Mensajes ({detail.messages.length})
                </h3>
                <div className="flex flex-col gap-3">
                  {detail.messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}
