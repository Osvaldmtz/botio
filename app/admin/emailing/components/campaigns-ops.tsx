'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Send } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card } from './ui/card';

type SubTab = 'campanas' | 'automatizaciones' | 'logs';

type SegmentSummary = {
  id: string;
  label: string;
  description: string;
  count: number;
};

type Campaign = {
  id: string;
  name: string;
  subject: string;
  htmlBody: string;
  segment: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
};

type Automation = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  triggerType: string;
  delayDays: number;
  active: boolean;
};

type LogRow = {
  id: string;
  to: string;
  sequence: string;
  status: string;
  sentAt: string;
  errorMessage?: string | null;
};

const SUBTABS: { id: SubTab; label: string }[] = [
  { id: 'campanas', label: 'Campañas' },
  { id: 'automatizaciones', label: 'Automatizaciones' },
  { id: 'logs', label: 'Logs' },
];

const DEFAULT_HTML = `<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:24px;background:#F5F5F5;font-family:Arial,sans-serif;color:#1A1B2E;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;">
      <tr><td style="background:#8C52FF;padding:20px 28px;color:#fff;font-weight:700;font-size:18px;">Kalyo</td></tr>
      <tr><td style="padding:28px;">
        <p style="margin:0 0 12px;font-size:16px;">Hola{{name}},</p>
        <p style="margin:0;font-size:15px;line-height:1.6;color:#5C6380;">Escribe aquí el contenido de tu campaña.</p>
        <p style="margin:24px 0 0;">
          <a href="https://app.kalyo.io/login" style="display:inline-block;background:#1A1B2E;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;">Abrir Kalyo</a>
        </p>
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`;

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function statusLabel(status: Campaign['status']): string {
  const map: Record<Campaign['status'], string> = {
    draft: 'Borrador',
    scheduled: 'Programada',
    sending: 'Enviando',
    sent: 'Enviada',
    failed: 'Error',
  };
  return map[status];
}

function statusTone(
  status: Campaign['status'],
): 'muted' | 'accent' | 'positive' | 'negative' | 'warning' {
  if (status === 'sent') return 'positive';
  if (status === 'scheduled' || status === 'sending') return 'accent';
  if (status === 'failed') return 'negative';
  return 'muted';
}

function triggerLabel(type: string): string {
  const map: Record<string, string> = {
    stripe_subscription_active: 'Stripe webhook (suscripción activa)',
    trial_enrollment: 'Enrollment trial',
    subscription_cancelled: 'Cancelación de suscripción',
  };
  return map[type] ?? type;
}

export function CampaignsOps() {
  const [subTab, setSubTab] = useState<SubTab>('campanas');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [segments, setSegments] = useState<SegmentSummary[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [form, setForm] = useState({
    name: '',
    subject: '',
    segment: 'trial_activo',
    htmlBody: DEFAULT_HTML,
    scheduledAt: '',
  });

  const previewSrcDoc = useMemo(() => form.htmlBody, [form.htmlBody]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cRes, sRes, aRes, lRes] = await Promise.all([
        fetch('/api/admin/emailing/campaigns'),
        fetch('/api/admin/emailing/segments'),
        fetch('/api/admin/emailing/automations'),
        fetch('/api/admin/emailing/logs?page=1'),
      ]);
      const [cJson, sJson, aJson, lJson] = await Promise.all([
        cRes.json(),
        sRes.json(),
        aRes.json(),
        lRes.json(),
      ]);
      if (!cRes.ok) throw new Error(cJson.error || 'Error campañas');
      if (!sRes.ok) throw new Error(sJson.error || 'Error segmentos');
      if (!aRes.ok) throw new Error(aJson.error || 'Error automatizaciones');
      if (!lRes.ok) throw new Error(lJson.error || 'Error logs');
      setCampaigns(cJson.campaigns ?? []);
      setSegments(sJson.segments ?? []);
      setAutomations(aJson.automations ?? []);
      setLogs(lJson.logs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openNew() {
    setEditingId(null);
    setForm({
      name: '',
      subject: '',
      segment: segments[0]?.id ?? 'trial_activo',
      htmlBody: DEFAULT_HTML,
      scheduledAt: '',
    });
    setTestEmail('');
    setShowForm(true);
  }

  function openEdit(campaign: Campaign) {
    setEditingId(campaign.id);
    setForm({
      name: campaign.name,
      subject: campaign.subject,
      segment: campaign.segment,
      htmlBody: campaign.htmlBody,
      scheduledAt: campaign.scheduledAt
        ? campaign.scheduledAt.slice(0, 16)
        : '',
    });
    setTestEmail('');
    setShowForm(true);
  }

  async function saveDraft(): Promise<string | null> {
    setBusy(true);
    setError(null);
    try {
      if (editingId) {
        const res = await fetch(`/api/admin/emailing/campaigns/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save',
            name: form.name,
            subject: form.subject,
            htmlBody: form.htmlBody,
            segment: form.segment,
            scheduledAt: form.scheduledAt
              ? new Date(form.scheduledAt).toISOString()
              : null,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'No se pudo guardar');
        await load();
        return editingId;
      }

      const res = await fetch('/api/admin/emailing/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          subject: form.subject,
          htmlBody: form.htmlBody,
          segment: form.segment,
          scheduledAt: form.scheduledAt
            ? new Date(form.scheduledAt).toISOString()
            : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo crear');
      setEditingId(json.campaign.id);
      await load();
      return json.campaign.id as string;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    if (!testEmail.includes('@')) {
      setError('Ingresa un email de prueba válido');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/emailing/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          testEmail,
          subject: form.subject || 'Prueba Kalyo',
          htmlBody: form.htmlBody,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falló el envío de prueba');
      alert(`Prueba enviada a ${testEmail}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function scheduleOrSend(mode: 'schedule' | 'send_now') {
    setBusy(true);
    setError(null);
    try {
      const id = editingId ?? (await saveDraft());
      if (!id) return;

      if (mode === 'schedule' && !form.scheduledAt) {
        setError('Elige fecha y hora de envío');
        return;
      }

      const res = await fetch(`/api/admin/emailing/campaigns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: mode,
          name: form.name,
          subject: form.subject,
          htmlBody: form.htmlBody,
          segment: form.segment,
          scheduledAt: form.scheduledAt
            ? new Date(form.scheduledAt).toISOString()
            : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Operación fallida');
      setShowForm(false);
      await load();
      if (mode === 'send_now') {
        alert(`Campaña enviada: ${json.sent ?? 0} ok, ${json.failed ?? 0} error`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleAutomation(automation: Automation) {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/emailing/automations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: automation.id, active: !automation.active }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo actualizar');
      setAutomations((prev) =>
        prev.map((a) => (a.id === automation.id ? json.automation : a)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-ky-h2 text-ky-text-primary">Emailing</h1>
          <p className="mt-1 text-ky-sm text-ky-text-secondary">
            Campañas, segmentos, automatizaciones y logs (Resend + Supabase).
          </p>
        </div>
        {subTab === 'campanas' && !showForm ? (
          <Button type="button" onClick={openNew} size="sm">
            <Plus className="h-4 w-4" />
            Nueva campaña
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-ky-border pb-3">
        {SUBTABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setSubTab(t.id);
              setShowForm(false);
            }}
            className={cn(
              'rounded-ky-badge px-3 py-1.5 text-ky-sm font-medium transition-colors',
              subTab === t.id
                ? 'bg-ky-accent text-white'
                : 'bg-ky-surface-1 text-ky-text-secondary hover:text-ky-text-primary',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-ky-card border border-red-200 bg-red-50 px-4 py-3 text-ky-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-ky-sm text-ky-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando…
        </div>
      ) : null}

      {!loading && subTab === 'campanas' && !showForm ? (
        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="text-ky-h3 text-ky-text-primary">Segmentos</h2>
            <p className="mt-1 text-ky-sm text-ky-text-secondary">
              Desde `psychologists` (plan / subscription_status).
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {segments.map((seg) => (
                <div
                  key={seg.id}
                  className="rounded-ky-card border border-ky-border bg-ky-surface-1 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-ky-sm font-medium text-ky-text-primary">
                      {seg.label}
                    </span>
                    <Badge>{seg.count}</Badge>
                  </div>
                  <p className="mt-1 text-ky-caption text-ky-text-muted">
                    {seg.id} · {seg.description}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-ky-border px-4 py-3">
              <h2 className="text-ky-h3 text-ky-text-primary">Campañas</h2>
            </div>
            {campaigns.length === 0 ? (
              <p className="px-4 py-8 text-center text-ky-sm text-ky-text-secondary">
                No hay campañas. Crea la primera con “Nueva campaña”.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-ky-sm">
                  <thead className="bg-ky-surface-1 text-ky-caption uppercase tracking-wide text-ky-text-muted">
                    <tr>
                      <th className="px-4 py-2 font-medium">Nombre</th>
                      <th className="px-4 py-2 font-medium">Segmento</th>
                      <th className="px-4 py-2 font-medium">Estado</th>
                      <th className="px-4 py-2 font-medium">Fecha</th>
                      <th className="px-4 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((c) => (
                      <tr key={c.id} className="border-t border-ky-border">
                        <td className="px-4 py-3">
                          <div className="font-medium text-ky-text-primary">
                            {c.name}
                          </div>
                          <div className="text-ky-caption text-ky-text-muted">
                            {c.subject}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-ky-text-secondary">
                          {c.segment}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={statusTone(c.status)}>
                            {statusLabel(c.status)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-ky-text-secondary">
                          {formatDate(c.sentAt ?? c.scheduledAt ?? c.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(c)}
                          >
                            Abrir
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {!loading && subTab === 'campanas' && showForm ? (
        <Card className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-ky-h3 text-ky-text-primary">
              {editingId ? 'Editar campaña' : 'Nueva campaña'}
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowForm(false)}
            >
              Volver
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-ky-sm">
              <span className="text-ky-text-secondary">Nombre</span>
              <input
                className="mt-1 w-full rounded-ky-badge border border-ky-border bg-ky-surface-0 px-3 py-2 text-ky-text-primary"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>
            <label className="block text-ky-sm">
              <span className="text-ky-text-secondary">Asunto</span>
              <input
                className="mt-1 w-full rounded-ky-badge border border-ky-border bg-ky-surface-0 px-3 py-2 text-ky-text-primary"
                value={form.subject}
                onChange={(e) =>
                  setForm((f) => ({ ...f, subject: e.target.value }))
                }
              />
            </label>
            <label className="block text-ky-sm">
              <span className="text-ky-text-secondary">Segmento destino</span>
              <select
                className="mt-1 w-full rounded-ky-badge border border-ky-border bg-ky-surface-0 px-3 py-2 text-ky-text-primary"
                value={form.segment}
                onChange={(e) =>
                  setForm((f) => ({ ...f, segment: e.target.value }))
                }
              >
                {segments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} ({s.count})
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-ky-sm">
              <span className="text-ky-text-secondary">Fecha de envío</span>
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-ky-badge border border-ky-border bg-ky-surface-0 px-3 py-2 text-ky-text-primary"
                value={form.scheduledAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, scheduledAt: e.target.value }))
                }
              />
            </label>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <label className="block text-ky-sm">
              <span className="text-ky-text-secondary">HTML del email</span>
              <textarea
                className="mt-1 h-[420px] w-full rounded-ky-card border border-ky-border bg-ky-surface-0 p-3 font-mono text-xs text-ky-text-primary"
                value={form.htmlBody}
                onChange={(e) =>
                  setForm((f) => ({ ...f, htmlBody: e.target.value }))
                }
              />
            </label>
            <div>
              <span className="text-ky-sm text-ky-text-secondary">
                Preview en tiempo real
              </span>
              <iframe
                title="Preview email"
                className="mt-1 h-[420px] w-full rounded-ky-card border border-ky-border bg-white"
                srcDoc={previewSrcDoc}
                sandbox=""
              />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2 border-t border-ky-border pt-4">
            <label className="block min-w-[220px] flex-1 text-ky-sm">
              <span className="text-ky-text-secondary">Email de prueba</span>
              <input
                type="email"
                className="mt-1 w-full rounded-ky-badge border border-ky-border bg-ky-surface-0 px-3 py-2"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="tu@email.com"
              />
            </label>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => void sendTest()}
            >
              <Send className="h-3.5 w-3.5" />
              Enviar prueba
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy || !form.name || !form.subject}
              onClick={() => void saveDraft()}
            >
              Guardar borrador
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy || !form.name || !form.subject}
              onClick={() => void scheduleOrSend('schedule')}
            >
              Programar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy || !form.name || !form.subject}
              onClick={() => void scheduleOrSend('send_now')}
            >
              Enviar ahora
            </Button>
          </div>
        </Card>
      ) : null}

      {!loading && subTab === 'automatizaciones' ? (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-ky-border px-4 py-3">
            <h2 className="text-ky-h3 text-ky-text-primary">Automatizaciones</h2>
            <p className="mt-1 text-ky-sm text-ky-text-secondary">
              Flujos activos con trigger y estado.
            </p>
          </div>
          <div className="divide-y divide-ky-border">
            {automations.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ky-text-primary">
                      {a.name}
                    </span>
                    <Badge tone={a.active ? 'positive' : 'muted'}>
                      {a.active ? 'Activo' : 'Pausado'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-ky-sm text-ky-text-secondary">
                    {a.description}
                  </p>
                  <p className="mt-1 text-ky-caption text-ky-text-muted">
                    Trigger: {triggerLabel(a.triggerType)}
                    {a.delayDays > 0 ? ` · +${a.delayDays} días` : ' · inmediato'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => void toggleAutomation(a)}
                >
                  {a.active ? 'Pausar' : 'Activar'}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {!loading && subTab === 'logs' ? (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-ky-border px-4 py-3">
            <h2 className="text-ky-h3 text-ky-text-primary">Logs de envío</h2>
          </div>
          {logs.length === 0 ? (
            <p className="px-4 py-8 text-center text-ky-sm text-ky-text-secondary">
              Aún no hay envíos registrados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-ky-sm">
                <thead className="bg-ky-surface-1 text-ky-caption uppercase tracking-wide text-ky-text-muted">
                  <tr>
                    <th className="px-4 py-2 font-medium">Email</th>
                    <th className="px-4 py-2 font-medium">Campaña / secuencia</th>
                    <th className="px-4 py-2 font-medium">Fecha</th>
                    <th className="px-4 py-2 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-t border-ky-border">
                      <td className="px-4 py-3 text-ky-text-primary">{log.to}</td>
                      <td className="px-4 py-3 text-ky-text-secondary">
                        {log.sequence}
                      </td>
                      <td className="px-4 py-3 text-ky-text-secondary">
                        {formatDate(log.sentAt)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          tone={
                            log.status === 'error' || log.status === 'bounced'
                              ? 'negative'
                              : log.status === 'opened'
                                ? 'accent'
                                : 'positive'
                          }
                        >
                          {log.status === 'error' ? 'error' : log.status === 'sent' ? 'enviado' : log.status}
                        </Badge>
                        {log.errorMessage ? (
                          <div className="mt-1 max-w-xs truncate text-ky-caption text-red-600">
                            {log.errorMessage}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}
