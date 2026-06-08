'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Copy, ExternalLink } from 'lucide-react';
import type { ConversationDetail } from '../lib/conversation-queries';
import { channelBadge, formatCustomerIdentifier } from '@/lib/channel-utils';
import {
  avatarLabel,
  conversationStatus,
  extractLeadName,
  formatRelativeTime,
  isHandoffActive,
  temperatureBadge,
  whatsAppUrl,
} from '../lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageBubble } from './message-bubble';
import { HandoffControls, getHandoffAdminName } from './handoff-controls';
import { HandoffChatBox } from './handoff-chat-box';
import { ConversationClosureControls } from './conversation-closure-controls';
import { cn } from '@/lib/cn';

type Props = {
  conversationId: string | null;
  onClose: () => void;
  onHandoffChange?: () => void;
};

function LeadField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 py-2">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-fg-tertiary">
        {label}
      </dt>
      <dd className="text-right text-sm text-fg">{value}</dd>
    </div>
  );
}

export function ConversationDetailPanel({
  conversationId,
  onClose,
  onHandoffChange,
}: Props) {
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'messages'>('messages');
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
    const interval = setInterval(() => void loadDetail(conversationId), 10_000);
    return () => clearInterval(interval);
  }, [conversationId, detail?.handoff_active, loadDetail]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [detail?.messages.length, activeTab]);

  function handleUpdated() {
    if (conversationId) void loadDetail(conversationId);
    onHandoffChange?.();
  }

  if (!conversationId) return null;

  const status = detail ? conversationStatus(detail) : null;
  const temp = detail ? temperatureBadge(detail.lead_temperature) : null;
  const channel = detail ? channelBadge(detail.channel) : null;
  const title = detail
    ? extractLeadName(detail.customer_phone, detail.lead_signals)
    : 'Cargando…';

  async function copyPhone() {
    if (!detail?.customer_phone) return;
    await navigator.clipboard.writeText(detail.customer_phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-fg/20 transition-opacity duration-200 lg:hidden"
        onClick={onClose}
        aria-hidden
      />

      <aside
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col border-l border-bg-border bg-bg',
          'transition-transform duration-200 ease-out lg:static lg:z-0 lg:shrink-0',
        )}
      >
        <header className="border-b border-bg-border px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-bg-subtle text-sm font-medium text-fg-muted">
                {detail ? avatarLabel(detail.customer_phone, detail.lead_temperature) : '…'}
              </div>
              <div>
                <h2 className="text-sm font-semibold text-fg">{title}</h2>
                {detail ? (
                  <p className="font-mono text-xs text-fg-muted">
                    {formatCustomerIdentifier(detail.customer_phone, detail.channel)}
                  </p>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>

          <div className="mt-4 flex gap-4 border-b border-bg-border">
            {(['messages', 'info'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'border-b-2 pb-2 text-sm transition-colors duration-150',
                  activeTab === tab
                    ? 'border-accent font-medium text-fg'
                    : 'border-transparent text-fg-muted hover:text-fg',
                )}
              >
                {tab === 'messages' ? 'Mensajes' : 'Info'}
              </button>
            ))}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading && !detail ? (
            <p className="p-4 text-sm text-fg-muted">Cargando conversación…</p>
          ) : error ? (
            <p className="p-4 text-sm text-semantic-hot">{error}</p>
          ) : detail ? (
            <div className="space-y-4 p-4">
              <ConversationClosureControls
                conversationId={detail.id}
                closureReason={detail.closure_reason}
                closureNote={detail.closure_note}
                closedAt={detail.closed_at}
                onUpdated={handleUpdated}
              />
              <HandoffControls detail={detail} onUpdated={handleUpdated} />

              {isHandoffActive(detail) ? (
                <HandoffChatBox
                  detail={detail}
                  adminName={getHandoffAdminName()}
                  onSent={handleUpdated}
                />
              ) : null}

              {activeTab === 'info' ? (
                <section className="rounded-card border border-bg-border p-4">
                  <dl className="divide-y divide-bg-border">
                    <LeadField label="Contacto" value={title} />
                    <LeadField
                      label="Canal"
                      value={
                        channel ? (
                          <Badge tone={channel.tone}>
                            {channel.emoji} {channel.label}
                          </Badge>
                        ) : (
                          '—'
                        )
                      }
                    />
                    <LeadField label="Bot" value={detail.bot_name} />
                    <LeadField label="Estado" value={status?.label ?? '—'} />
                    <LeadField label="Score" value={detail.lead_score ?? '—'} />
                    <LeadField
                      label="Temperatura"
                      value={
                        temp ? (
                          <Badge tone={temp.tone === 'hot' ? 'hot' : temp.tone === 'warm' ? 'warning' : 'gray'}>
                            {temp.label}
                          </Badge>
                        ) : (
                          '—'
                        )
                      }
                    />
                    <LeadField label="Intención" value={detail.lead_intent ?? '—'} />
                    <LeadField label="Ciudad" value={detail.lead_city ?? '—'} />
                    <LeadField label="País" value={detail.lead_country ?? '—'} />
                    <LeadField label="Lead capturado" value={detail.lead_captured ? 'Sí' : 'No'} />
                    <LeadField label="Último mensaje" value={formatRelativeTime(detail.last_message_at)} />
                  </dl>

                  {detail.lead_signals?.length ? (
                    <div className="mt-4 flex flex-wrap gap-1">
                      {detail.lead_signals.map((signal) => (
                        <Badge key={signal} tone="gray">
                          {signal}
                        </Badge>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={() => void copyPhone()}>
                      <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
                      {copied ? 'Copiado' : 'Copiar ID'}
                    </Button>
                    {(detail.channel ?? 'whatsapp') === 'whatsapp' ? (
                      <a
                        href={whatsAppUrl(detail.customer_phone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded border border-bg-border bg-bg px-2.5 py-1 text-xs font-medium text-fg transition-colors hover:bg-bg-elevated"
                      >
                        <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
                        WhatsApp
                      </a>
                    ) : null}
                  </div>
                </section>
              ) : (
                <section>
                  <div className="flex flex-col gap-4">
                    {detail.messages.map((msg) => (
                      <MessageBubble key={msg.id} message={msg} />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </section>
              )}
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}
