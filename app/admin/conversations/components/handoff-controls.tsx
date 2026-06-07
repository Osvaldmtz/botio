'use client';

import { useState } from 'react';
import { UserRound } from 'lucide-react';
import { formatRelativeTime, isHandoffActive } from '../lib/format';
import type { ConversationDetail } from '../lib/conversation-queries';
import { Button } from '@/components/ui/button';

const ADMIN_NAME_KEY = 'botio_handoff_name';

type Props = {
  detail: ConversationDetail;
  onUpdated: () => void;
};

function getStoredAdminName(): string {
  if (typeof window === 'undefined') return 'Admin';
  return window.localStorage.getItem(ADMIN_NAME_KEY) ?? 'Admin';
}

function storeAdminName(name: string) {
  window.localStorage.setItem(ADMIN_NAME_KEY, name);
}

export function HandoffControls({ detail, onUpdated }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminName, setAdminName] = useState(getStoredAdminName);

  async function handleTake() {
    const takenBy =
      window.prompt('¿Tu nombre para el handoff?', adminName)?.trim() || adminName;
    storeAdminName(takenBy);
    setAdminName(takenBy);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/conversations/${detail.id}/handoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'take', taken_by: takenBy }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleRelease() {
    if (!window.confirm('¿Devolver esta conversación al bot?')) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/conversations/${detail.id}/handoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'release' }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  if (isHandoffActive(detail)) {
    return (
      <section className="rounded-card border-l-[3px] border-l-semantic-warning bg-semantic-warning-bg px-4 py-3">
        <div className="flex items-start gap-2">
          <UserRound className="mt-0.5 h-4 w-4 text-semantic-warning" strokeWidth={1.5} />
          <div className="flex-1">
            <p className="text-sm text-fg">
              Atendido por <span className="font-medium">{detail.handoff_taken_by ?? 'Admin'}</span>
              {detail.handoff_started_at
                ? ` desde ${formatRelativeTime(detail.handoff_started_at)}`
                : ''}
            </p>
            {error ? <p className="mt-1 text-xs text-semantic-hot">{error}</p> : null}
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => void handleRelease()}
              disabled={loading}
            >
              {loading ? 'Procesando…' : 'Devolver al bot'}
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-card border border-bg-border bg-bg-elevated p-4">
      <p className="text-sm text-fg-muted">
        Toma control para responder manualmente. El bot dejará de contestar.
      </p>
      {error ? <p className="mt-2 text-xs text-semantic-hot">{error}</p> : null}
      <Button
        variant="secondary"
        size="sm"
        className="mt-3"
        onClick={() => void handleTake()}
        disabled={loading || detail.is_closed}
      >
        {loading ? 'Procesando…' : 'Tomar control'}
      </Button>
    </section>
  );
}

export function getHandoffAdminName(): string {
  return getStoredAdminName();
}
