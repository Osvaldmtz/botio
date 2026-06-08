'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  CLOSURE_REASONS,
  CLOSURE_REASON_UI,
  formatClosureLabel,
  type ClosureReason,
} from '@/lib/conversation-closure-constants';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';

type Props = {
  conversationId: string;
  closureReason: string | null;
  closureNote: string | null;
  closedAt: string | null;
  onUpdated: () => void;
};

export function ConversationClosureControls({
  conversationId,
  closureReason,
  closureNote,
  closedAt,
  onUpdated,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<ClosureReason | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isClosed = Boolean(closureReason && closedAt);

  async function handleClose() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/conversations/${conversationId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: selected,
          note: selected === 'other' ? note : note || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setModalOpen(false);
      setSelected(null);
      setNote('');
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReopen() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/conversations/${conversationId}/reopen`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-card border border-bg-border p-4">
      {isClosed && closureReason ? (
        <div className="space-y-3">
          <Badge tone="gray">
            Cerrada el{' '}
            {format(new Date(closedAt!), "d MMM yyyy HH:mm", { locale: es })} • Razón:{' '}
            {formatClosureLabel(closureReason as ClosureReason)}
          </Badge>
          {closureNote ? (
            <p className="text-xs text-fg-muted">Nota: {closureNote}</p>
          ) : null}
          <Button variant="secondary" size="sm" onClick={() => void handleReopen()} disabled={submitting}>
            Reabrir
          </Button>
        </div>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          className="border-semantic-hot/30 text-semantic-hot hover:bg-semantic-hot/10"
          onClick={() => setModalOpen(true)}
        >
          Cerrar conversación
        </Button>
      )}

      {error ? <p className="mt-2 text-xs text-semantic-hot">{error}</p> : null}

      {modalOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-fg/30 p-4">
          <div className="w-full max-w-lg rounded-card border border-bg-border bg-bg p-5 shadow-lg">
            <h3 className="text-base font-semibold text-fg">¿Por qué cierras esta conversación?</h3>
            <p className="mt-1 text-sm text-fg-muted">Selecciona la razón más cercana al resultado real.</p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {CLOSURE_REASONS.map((reason) => {
                const ui = CLOSURE_REASON_UI[reason];
                return (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setSelected(reason)}
                    className={cn(
                      'rounded border px-3 py-2 text-left text-sm transition-colors',
                      selected === reason
                        ? 'border-accent bg-accent-muted text-fg'
                        : 'border-bg-border hover:bg-bg-subtle',
                    )}
                  >
                    <span className="font-medium">
                      {ui.emoji} {ui.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-fg-muted">{ui.description}</span>
                  </button>
                );
              })}
            </div>

            {selected === 'other' ? (
              <textarea
                className="mt-3 w-full rounded border border-bg-border bg-bg px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-muted"
                rows={3}
                placeholder="Describe la razón (opcional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            ) : null}

            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setModalOpen(false);
                  setSelected(null);
                  setNote('');
                  setError(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={!selected || submitting}
                onClick={() => void handleClose()}
              >
                Confirmar cierre
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
