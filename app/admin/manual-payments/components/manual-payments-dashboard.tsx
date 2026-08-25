'use client';

import { useCallback, useMemo, useState } from 'react';
import { AdminShell } from '@/components/admin/admin-shell';
import {
  MANUAL_PAYMENT_PLANS,
  MANUAL_PAYMENT_PLATFORMS,
  type ManualPaymentPlan,
  type ManualPaymentPlatform,
  type ManualPaymentRow,
} from '@/lib/manual-payments-types';

type Props = {
  initialPayments: ManualPaymentRow[];
};

type FormState = {
  psychologist_email: string;
  psychologist_name: string;
  amount_mxn: string;
  amount_usd: string;
  platform: ManualPaymentPlatform;
  plan: ManualPaymentPlan;
  starts_at: string;
  ends_at: string;
  notes: string;
};

const PLAN_LABELS: Record<ManualPaymentPlan, string> = {
  starter: 'Pro (starter)',
  professional: 'Max (professional)',
  clinic: 'Clinic',
};

const PLATFORM_LABELS: Record<ManualPaymentPlatform, string> = {
  mercadopago: 'Mercado Pago',
  transferencia: 'Transferencia',
  otro: 'Otro',
};

function todayInput(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusOneYearInput(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function emptyForm(): FormState {
  return {
    psychologist_email: '',
    psychologist_name: '',
    amount_mxn: '',
    amount_usd: '',
    platform: 'mercadopago',
    plan: 'professional',
    starts_at: todayInput(),
    ends_at: plusOneYearInput(),
    notes: '',
  };
}

function formatMoney(value: number | null, currency: 'MXN' | 'USD'): string {
  if (value == null) return '—';
  return `$${Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  });
}

function isActive(row: ManualPaymentRow, now = Date.now()): boolean {
  return new Date(row.ends_at).getTime() > now;
}

export function ManualPaymentsDashboard({ initialPayments }: Props) {
  const [payments, setPayments] = useState(initialPayments);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const activeCount = useMemo(
    () => payments.filter((p) => isActive(p)).length,
    [payments],
  );

  const reload = useCallback(async () => {
    const res = await fetch('/api/admin/manual-payments');
    if (!res.ok) return;
    const json = (await res.json()) as { payments?: ManualPaymentRow[] };
    setPayments(json.payments ?? []);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const body = {
        psychologist_email: form.psychologist_email.trim(),
        psychologist_name: form.psychologist_name.trim() || null,
        amount_mxn: Number(form.amount_mxn),
        amount_usd: form.amount_usd.trim() ? Number(form.amount_usd) : null,
        platform: form.platform,
        plan: form.plan,
        starts_at: form.starts_at,
        ends_at: form.ends_at,
        notes: form.notes.trim() || null,
      };
      const res = await fetch('/api/admin/manual-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { error?: string; payment?: ManualPaymentRow };
      if (!res.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setSuccess(`Pago registrado: ${json.payment?.psychologist_email ?? body.psychologist_email}`);
      setModalOpen(false);
      setForm(emptyForm());
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell
      title="Pagos manuales"
      subtitle="Mercado Pago, transferencia y otros — sincroniza plan en Kalyo"
      actions={
        <button
          type="button"
          onClick={() => {
            setError(null);
            setForm(emptyForm());
            setModalOpen(true);
          }}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Registrar pago manual
        </button>
      }
    >
      {success ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {success}
        </p>
      ) : null}
      {error && !modalOpen ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <p className="text-sm text-fg-muted">
        {payments.length} registro{payments.length === 1 ? '' : 's'} · {activeCount} activo
        {activeCount === 1 ? '' : 's'}
      </p>

      <div className="overflow-x-auto rounded-lg border border-bg-border">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-bg-border bg-bg-subtle text-xs uppercase tracking-wide text-fg-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Psicólogo</th>
              <th className="px-3 py-2 font-medium">Plan</th>
              <th className="px-3 py-2 font-medium">Monto</th>
              <th className="px-3 py-2 font-medium">Plataforma</th>
              <th className="px-3 py-2 font-medium">Vigencia</th>
              <th className="px-3 py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-fg-muted">
                  Sin pagos manuales aún.
                </td>
              </tr>
            ) : (
              payments.map((row) => {
                const active = isActive(row);
                return (
                  <tr key={row.id} className="border-b border-bg-border last:border-0">
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-fg">
                        {row.psychologist_name ?? '—'}
                      </div>
                      <div className="text-xs text-fg-muted">{row.psychologist_email}</div>
                      {row.notes ? (
                        <div className="mt-0.5 text-xs text-fg-muted">{row.notes}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5">{PLAN_LABELS[row.plan] ?? row.plan}</td>
                    <td className="px-3 py-2.5">
                      <div>{formatMoney(Number(row.amount_mxn), 'MXN')}</div>
                      <div className="text-xs text-fg-muted">
                        {formatMoney(row.amount_usd != null ? Number(row.amount_usd) : null, 'USD')}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {PLATFORM_LABELS[row.platform] ?? row.platform}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {formatDate(row.starts_at)} → {formatDate(row.ends_at)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={
                          active
                            ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700'
                            : 'rounded-full bg-bg-subtle px-2 py-0.5 text-xs font-medium text-fg-muted'
                        }
                      >
                        {active ? 'Activo' : 'Vencido'}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="manual-payment-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-bg-border bg-bg p-5 shadow-lg"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 id="manual-payment-title" className="text-lg font-semibold text-fg">
                  Registrar pago manual
                </h2>
                <p className="mt-1 text-sm text-fg-muted">
                  Crea el registro y actualiza plan/status en Kalyo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-fg-muted hover:text-fg"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <form onSubmit={submit} className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-fg-muted">Email *</span>
                <input
                  required
                  type="email"
                  value={form.psychologist_email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, psychologist_email: e.target.value }))
                  }
                  className="w-full rounded-md border border-bg-border bg-bg px-3 py-2 text-fg"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-fg-muted">Nombre</span>
                <input
                  type="text"
                  value={form.psychologist_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, psychologist_name: e.target.value }))
                  }
                  className="w-full rounded-md border border-bg-border bg-bg px-3 py-2 text-fg"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="mb-1 block text-fg-muted">Monto MXN *</span>
                  <input
                    required
                    type="number"
                    min={1}
                    step="0.01"
                    value={form.amount_mxn}
                    onChange={(e) => setForm((f) => ({ ...f, amount_mxn: e.target.value }))}
                    className="w-full rounded-md border border-bg-border bg-bg px-3 py-2 text-fg"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-fg-muted">Monto USD (opcional)</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.amount_usd}
                    onChange={(e) => setForm((f) => ({ ...f, amount_usd: e.target.value }))}
                    className="w-full rounded-md border border-bg-border bg-bg px-3 py-2 text-fg"
                    placeholder="Auto FX"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="mb-1 block text-fg-muted">Plataforma *</span>
                  <select
                    value={form.platform}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        platform: e.target.value as ManualPaymentPlatform,
                      }))
                    }
                    className="w-full rounded-md border border-bg-border bg-bg px-3 py-2 text-fg"
                  >
                    {MANUAL_PAYMENT_PLATFORMS.map((p) => (
                      <option key={p} value={p}>
                        {PLATFORM_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-fg-muted">Plan *</span>
                  <select
                    value={form.plan}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, plan: e.target.value as ManualPaymentPlan }))
                    }
                    className="w-full rounded-md border border-bg-border bg-bg px-3 py-2 text-fg"
                  >
                    {MANUAL_PAYMENT_PLANS.map((p) => (
                      <option key={p} value={p}>
                        {PLAN_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="mb-1 block text-fg-muted">Inicio *</span>
                  <input
                    required
                    type="date"
                    value={form.starts_at}
                    onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                    className="w-full rounded-md border border-bg-border bg-bg px-3 py-2 text-fg"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-fg-muted">Fin *</span>
                  <input
                    required
                    type="date"
                    value={form.ends_at}
                    onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
                    className="w-full rounded-md border border-bg-border bg-bg px-3 py-2 text-fg"
                  />
                </label>
              </div>
              <label className="block text-sm">
                <span className="mb-1 block text-fg-muted">Notas</span>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-md border border-bg-border bg-bg px-3 py-2 text-fg"
                />
              </label>

              {error ? (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  {error}
                </p>
              ) : null}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-md border border-bg-border px-3 py-2 text-sm text-fg-muted hover:text-fg"
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
                >
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
