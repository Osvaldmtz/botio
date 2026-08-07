'use client';

import { useCallback, useEffect, useState } from 'react';
import { Mail, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import type { EmailLog, EmailMetrics, EmailSequence } from '@/lib/emailing/types';

type TabId = 'enviados' | 'secuencias' | 'metricas' | 'preview';

const TABS: { id: TabId; label: string }[] = [
  { id: 'enviados', label: 'Enviados' },
  { id: 'secuencias', label: 'Secuencias' },
  { id: 'metricas', label: 'Métricas' },
  { id: 'preview', label: 'Preview' },
];

function statusTone(status: EmailLog['status']): 'primary' | 'info' | 'hot' {
  if (status === 'opened') return 'info';
  if (status === 'bounced') return 'hot';
  return 'primary';
}

function statusLabel(status: EmailLog['status']): string {
  if (status === 'opened') return 'abierto';
  if (status === 'bounced') return 'rebotado';
  return 'enviado';
}

function triggerDisplay(seq: EmailSequence): string {
  if (seq.cancelOnTag) return `Sin ${seq.cancelOnTag}`;
  return seq.triggerTag;
}

function delayDisplay(days: number): string {
  if (days <= 0) return 'Inmediato';
  if (days === 1) return '1 día';
  return `${days} días`;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function SkeletonRows({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-t border-bg-border">
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j} className="px-3 py-3">
              <div className="h-3.5 w-full animate-pulse rounded bg-bg-subtle" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-fg/40"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-card border border-bg-border bg-bg shadow-lg">
        <div className="flex items-center justify-between border-b border-bg-border px-4 py-3">
          <h3 className="text-sm font-semibold text-fg">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-fg-muted hover:text-fg"
          >
            Cerrar
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-4">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-bg-border px-4 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function EmailingDashboard() {
  const [tab, setTab] = useState<TabId>('enviados');

  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsLoading, setLogsLoading] = useState(true);

  const [sequences, setSequences] = useState<EmailSequence[]>([]);
  const [sequencesLoading, setSequencesLoading] = useState(true);

  const [metrics, setMetrics] = useState<EmailMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);

  const [previewId, setPreviewId] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const [logPreview, setLogPreview] = useState<{
    subject: string;
    html: string;
    to: string;
    sequence: string;
  } | null>(null);

  const [editSeq, setEditSeq] = useState<EmailSequence | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);

  const loadLogs = useCallback(async (page: number) => {
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/admin/emailing/logs?page=${page}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        logs: EmailLog[];
        page: number;
        total: number;
      };
      setLogs(data.logs);
      setLogsPage(data.page);
      setLogsTotal(data.total);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const loadSequences = useCallback(async () => {
    setSequencesLoading(true);
    try {
      const res = await fetch('/api/admin/emailing/sequences');
      if (!res.ok) return;
      const data = (await res.json()) as { sequences: EmailSequence[] };
      setSequences(data.sequences);
      setPreviewId((current) => current || data.sequences[0]?.id || '');
    } finally {
      setSequencesLoading(false);
    }
  }, []);

  const loadMetrics = useCallback(async () => {
    setMetricsLoading(true);
    try {
      const res = await fetch('/api/admin/emailing/metrics');
      if (!res.ok) return;
      const data = (await res.json()) as { metrics: EmailMetrics };
      setMetrics(data.metrics);
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLogs(1);
    void loadSequences();
    void loadMetrics();
  }, [loadLogs, loadSequences, loadMetrics]);

  useEffect(() => {
    if (!previewId || tab !== 'preview') return;
    let cancelled = false;
    setPreviewLoading(true);
    void (async () => {
      try {
        const res = await fetch(
          `/api/admin/emailing/sequences/${previewId}/preview`,
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          preview: { html: string; subject: string };
        };
        setPreviewHtml(data.preview.html);
        setPreviewSubject(data.preview.subject);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [previewId, tab]);

  async function openLogPreview(id: string) {
    const res = await fetch(`/api/admin/emailing/logs?previewId=${id}`);
    if (!res.ok) return;
    const data = (await res.json()) as {
      preview: { subject: string; html: string; to: string; sequence: string };
    };
    setLogPreview(data.preview);
  }

  async function patchSequence(
    id: string,
    patch: { active?: boolean; delayDays?: number },
  ) {
    const res = await fetch(`/api/admin/emailing/sequences/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { sequence: EmailSequence };
    setSequences((prev) =>
      prev.map((s) => (s.id === id ? data.sequence : s)),
    );
  }

  async function sendTest() {
    if (!previewId || !testEmail.trim()) return;
    setTestSending(true);
    setTestMessage(null);
    try {
      const res = await fetch('/api/admin/emailing/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: testEmail.trim(),
          sequenceId: previewId,
          psychologistName: 'Prueba',
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setTestMessage(data.error ?? 'Error al enviar');
        return;
      }
      setTestMessage('Email de prueba enviado');
      setTestOpen(false);
      setTestEmail('');
      void loadLogs(1);
      void loadMetrics();
    } finally {
      setTestSending(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(logsTotal / 20));

  return (
    <div className="space-y-6">
      <div className="flex gap-1 border-b border-bg-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              tab === t.id
                ? 'border-accent text-fg'
                : 'border-transparent text-fg-muted hover:text-fg',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'enviados' ? (
        <div className="space-y-4">
          {!logsLoading && logs.length === 0 ? (
            <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-muted">
                <Mail className="h-5 w-5 text-accent" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium text-fg">
                Aún no se han enviado emails
              </p>
              <p className="max-w-sm text-xs text-fg-muted">
                Los envíos aparecerán aquí cuando se disparen secuencias o envíes
                una prueba desde Preview.
              </p>
            </Card>
          ) : (
            <>
              <div className="overflow-x-auto rounded-card border border-bg-border">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-bg-subtle text-xs uppercase tracking-wide text-fg-muted">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Destinatario</th>
                      <th className="px-3 py-2.5 font-medium">Secuencia</th>
                      <th className="px-3 py-2.5 font-medium">Estado</th>
                      <th className="px-3 py-2.5 font-medium">Fecha</th>
                      <th className="px-3 py-2.5 font-medium">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logsLoading ? (
                      <SkeletonRows cols={5} />
                    ) : (
                      logs.map((log) => (
                        <tr
                          key={log.id}
                          className="border-t border-bg-border hover:bg-bg-subtle/60"
                        >
                          <td className="px-3 py-2.5 text-fg">{log.to}</td>
                          <td className="px-3 py-2.5 text-fg">{log.sequence}</td>
                          <td className="px-3 py-2.5">
                            <Badge tone={statusTone(log.status)}>
                              {statusLabel(log.status)}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 text-fg-muted">
                            {formatDate(log.sentAt)}
                          </td>
                          <td className="px-3 py-2.5">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => void openLogPreview(log.id)}
                            >
                              Ver preview
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between text-xs text-fg-muted">
                <span>
                  {logsTotal} envío{logsTotal === 1 ? '' : 's'}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={logsPage <= 1 || logsLoading}
                    onClick={() => void loadLogs(logsPage - 1)}
                  >
                    Anterior
                  </Button>
                  <span>
                    {logsPage} / {totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={logsPage >= totalPages || logsLoading}
                    onClick={() => void loadLogs(logsPage + 1)}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}

      {tab === 'secuencias' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sequencesLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="h-44 animate-pulse bg-bg-subtle" />
              ))
            : sequences.map((seq, index) => (
                <Card key={seq.id} className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-fg-tertiary">
                        #{index + 1}
                      </p>
                      <h3 className="text-sm font-semibold text-fg">
                        {seq.name}
                      </h3>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={seq.active}
                      onClick={() =>
                        void patchSequence(seq.id, { active: !seq.active })
                      }
                      className={cn(
                        'relative h-6 w-11 shrink-0 rounded-full transition-colors',
                        seq.active ? 'bg-accent' : 'bg-bg-border',
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                          seq.active ? 'left-5' : 'left-0.5',
                        )}
                      />
                    </button>
                  </div>
                  <dl className="space-y-1 text-xs text-fg-muted">
                    <div className="flex justify-between gap-2">
                      <dt>Trigger</dt>
                      <dd className="font-medium text-fg">
                        {triggerDisplay(seq)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt>Delay</dt>
                      <dd className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          className="h-7 w-16 px-2 py-1 text-xs"
                          defaultValue={seq.delayDays}
                          onBlur={(e) => {
                            const value = Number(e.target.value);
                            if (
                              Number.isInteger(value) &&
                              value >= 0 &&
                              value !== seq.delayDays
                            ) {
                              void patchSequence(seq.id, { delayDays: value });
                            }
                          }}
                        />
                        <span>días</span>
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Estado</dt>
                      <dd>
                        <Badge tone={seq.active ? 'primary' : 'gray'}>
                          {seq.active ? 'activo' : 'inactivo'}
                        </Badge>
                      </dd>
                    </div>
                  </dl>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-auto"
                    onClick={() => setEditSeq(seq)}
                  >
                    Editar email
                  </Button>
                </Card>
              ))}
        </div>
      ) : null}

      {tab === 'metricas' ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: 'Total enviados',
                value: metricsLoading ? '—' : String(metrics?.totalSent ?? 0),
                hint: 'Último mes',
              },
              {
                label: 'Open rate',
                value: metricsLoading ? '—' : `${metrics?.openRate ?? 0}%`,
                hint: 'Promedio',
              },
              {
                label: 'Click rate',
                value: metricsLoading ? '—' : `${metrics?.clickRate ?? 0}%`,
                hint: 'Promedio',
              },
              {
                label: 'Bounces',
                value: metricsLoading ? '—' : `${metrics?.bounceRate ?? 0}%`,
                hint: 'Último mes',
              },
            ].map((kpi) => (
              <Card key={kpi.label}>
                <p className="text-xs text-fg-muted">{kpi.label}</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-fg">
                  {kpi.value}
                </p>
                <p className="mt-0.5 text-[11px] text-fg-tertiary">{kpi.hint}</p>
              </Card>
            ))}
          </div>

          <div className="overflow-x-auto rounded-card border border-bg-border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-bg-subtle text-xs uppercase tracking-wide text-fg-muted">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Secuencia</th>
                  <th className="px-3 py-2.5 font-medium">Enviados</th>
                  <th className="px-3 py-2.5 font-medium">Open %</th>
                  <th className="px-3 py-2.5 font-medium">Click %</th>
                  <th className="px-3 py-2.5 font-medium">Bounce %</th>
                </tr>
              </thead>
              <tbody>
                {metricsLoading ? (
                  <SkeletonRows cols={5} rows={4} />
                ) : (metrics?.bySequence.length ?? 0) === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-8 text-center text-sm text-fg-muted"
                    >
                      Sin datos en el último mes
                    </td>
                  </tr>
                ) : (
                  metrics!.bySequence.map((row) => (
                    <tr
                      key={row.sequenceId}
                      className="border-t border-bg-border"
                    >
                      <td className="px-3 py-2.5 text-fg">{row.sequence}</td>
                      <td className="px-3 py-2.5 text-fg">{row.sent}</td>
                      <td className="px-3 py-2.5 text-fg-muted">
                        {row.openRate}%
                      </td>
                      <td className="px-3 py-2.5 text-fg-muted">
                        {row.clickRate}%
                      </td>
                      <td className="px-3 py-2.5 text-fg-muted">
                        {row.bounceRate}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === 'preview' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs text-fg-muted">
              Secuencia
              <select
                className="h-9 rounded border border-bg-border bg-bg px-3 text-sm text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-muted"
                value={previewId}
                onChange={(e) => setPreviewId(e.target.value)}
              >
                {sequences.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {delayDisplay(s.delayDays)}
                  </option>
                ))}
              </select>
            </label>
            <Button
              onClick={() => {
                setTestMessage(null);
                setTestOpen(true);
              }}
              disabled={!previewId}
            >
              <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
              Enviar email de prueba
            </Button>
          </div>

          {testMessage ? (
            <p className="text-xs text-accent">{testMessage}</p>
          ) : null}

          <div className="mx-auto max-w-2xl rounded-card border border-bg-border bg-bg-subtle p-4 shadow-sm sm:p-6">
            <div className="mb-3 space-y-1 border-b border-bg-border pb-3 text-xs text-fg-muted">
              <p>
                <span className="text-fg-tertiary">De:</span> Kalyo &lt;hola@kalyo.io&gt;
              </p>
              <p>
                <span className="text-fg-tertiary">Asunto:</span>{' '}
                <span className="text-fg">{previewSubject || '—'}</span>
              </p>
            </div>
            <div className="overflow-hidden rounded border border-bg-border bg-white shadow">
              {previewLoading ? (
                <div className="flex h-[420px] items-center justify-center text-sm text-fg-muted">
                  Cargando preview…
                </div>
              ) : (
                <iframe
                  title="Email preview"
                  className="h-[520px] w-full bg-white"
                  sandbox=""
                  srcDoc={previewHtml}
                />
              )}
            </div>
          </div>
        </div>
      ) : null}

      <Modal
        open={Boolean(logPreview)}
        title="Preview del email"
        onClose={() => setLogPreview(null)}
      >
        {logPreview ? (
          <div className="space-y-3">
            <p className="text-xs text-fg-muted">
              {logPreview.sequence} → {logPreview.to}
            </p>
            <p className="text-sm font-medium text-fg">{logPreview.subject}</p>
            <iframe
              title="Log preview"
              className="h-[360px] w-full rounded border border-bg-border"
              sandbox=""
              srcDoc={logPreview.html}
            />
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(editSeq)}
        title="Plantilla del email"
        onClose={() => setEditSeq(null)}
      >
        {editSeq ? (
          <div className="space-y-3">
            <p className="rounded border border-bg-border bg-bg-subtle px-3 py-2 text-xs text-fg-muted">
              En v1 el subject y HTML se actualizan vía migración/seed. Aquí solo
              puedes ver la plantilla actual.
            </p>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-fg-tertiary">
                Subject
              </p>
              <p className="mt-1 text-sm text-fg">{editSeq.subject}</p>
            </div>
            <iframe
              title="Sequence template"
              className="h-[320px] w-full rounded border border-bg-border"
              sandbox=""
              srcDoc={editSeq.htmlTemplate}
            />
          </div>
        ) : null}
      </Modal>

      <Modal
        open={testOpen}
        title="Enviar email de prueba"
        onClose={() => setTestOpen(false)}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setTestOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={testSending || !testEmail.trim()}
              onClick={() => void sendTest()}
            >
              {testSending ? 'Enviando…' : 'Enviar'}
            </Button>
          </>
        }
      >
        <label className="flex flex-col gap-1 text-xs text-fg-muted">
          Email destino
          <Input
            type="email"
            placeholder="tu@email.com"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
          />
        </label>
      </Modal>
    </div>
  );
}
