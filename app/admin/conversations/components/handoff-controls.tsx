'use client';

import { useState } from 'react';
import { formatRelativeTime } from '../lib/format';
import type { ConversationDetail } from '../lib/conversation-queries';

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

  if (detail.handoff_active) {
    return (
      <section className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4">
        <p className="text-sm text-orange-200">
          🙋 Atendido por <strong>{detail.handoff_taken_by ?? 'Admin'}</strong>
          {detail.handoff_started_at
            ? ` desde ${formatRelativeTime(detail.handoff_started_at)}`
            : ''}
        </p>
        {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
        <button
          type="button"
          onClick={() => void handleRelease()}
          disabled={loading}
          className="mt-3 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/20 disabled:opacity-50"
        >
          {loading ? 'Procesando…' : 'Devolver al bot'}
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-bg-border bg-bg-elevated p-4">
      <p className="text-sm text-fg-muted">
        Toma control para responder manualmente por WhatsApp. El bot dejará de contestar.
      </p>
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
      <button
        type="button"
        onClick={() => void handleTake()}
        disabled={loading || detail.is_closed}
        className="mt-3 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-bg hover:bg-orange-400 disabled:opacity-50"
      >
        {loading ? 'Procesando…' : 'Tomar control'}
      </button>
    </section>
  );
}

export function getHandoffAdminName(): string {
  return getStoredAdminName();
}
