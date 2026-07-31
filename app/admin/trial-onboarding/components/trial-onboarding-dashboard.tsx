'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type Filter = 'active' | 'expiring' | 'upgraded' | 'unsubscribed' | 'all';

type OnboardingRow = {
  id: string;
  trial_user_name: string | null;
  trial_user_email: string;
  customer_phone: string;
  trial_started_at: string;
  trial_ends_at: string;
  conversation_id: string | null;
  days_passed: number;
  status: string;
  last_message_sent_at: string | null;
  customer_responded: boolean;
  upgraded_to_paid_at: string | null;
  unsubscribed: boolean;
};

type Metrics = {
  active_trials: number;
  conversion_rate_30d: number;
  response_rate_30d: number;
  unsubscribe_rate_30d: number;
  total_30d: number;
  survey_30d?: {
    sent: number;
    responded: number;
    pending: number;
    response_rate: number;
    breakdown: Record<string, number>;
  };
};

type SurveyResponseRow = {
  id: string;
  trial_user_name: string | null;
  trial_user_email: string;
  conversation_id: string | null;
  day_8_sent_at: string;
  day_8_response: string;
  day_8_response_label: string;
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Activo',
  upgraded: 'Convertido',
  expired: 'Expirado',
  unsubscribed: 'Unsubscribed',
};

export function TrialOnboardingDashboard() {
  const [filter, setFilter] = useState<Filter>('active');
  const [rows, setRows] = useState<OnboardingRow[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [surveyResponses, setSurveyResponses] = useState<SurveyResponseRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/trial-onboarding?filter=${filter}`);
      const json = (await res.json()) as {
        rows?: OnboardingRow[];
        metrics?: Metrics;
        survey_responses?: SurveyResponseRow[];
      };
      setRows(json.rows ?? []);
      setMetrics(json.metrics ?? null);
      setSurveyResponses(json.survey_responses ?? []);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const tabs: { id: Filter; label: string }[] = [
    { id: 'active', label: 'Activos' },
    { id: 'expiring', label: 'Por expirar' },
    { id: 'upgraded', label: 'Convertidos' },
    { id: 'unsubscribed', label: 'Unsubscribed' },
    { id: 'all', label: 'Todos' },
  ];

  return (
    <div className="space-y-6">
      {metrics ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Trials activos" value={String(metrics.active_trials)} />
          <MetricCard
            label="Conversión a paid (30d)"
            value={`${metrics.conversion_rate_30d}%`}
          />
          <MetricCard label="Tasa de respuesta (30d)" value={`${metrics.response_rate_30d}%`} />
          <MetricCard label="Unsubscribe (30d)" value={`${metrics.unsubscribe_rate_30d}%`} />
        </div>
      ) : null}

      {metrics?.survey_30d ? (
        <SurveySection survey={metrics.survey_30d} responses={surveyResponses} />
      ) : null}

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              filter === tab.id
                ? 'bg-accent text-white'
                : 'border border-bg-border text-fg-muted hover:text-fg'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-fg-muted">Cargando...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-fg-muted">Sin registros para este filtro.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-bg-border">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-bg-border bg-bg-subtle text-fg-muted">
              <tr>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Inicio</th>
                <th className="px-3 py-2">Fin</th>
                <th className="px-3 py-2">Días</th>
                <th className="px-3 py-2">Último msg</th>
                <th className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-bg-border/60">
                  <td className="px-3 py-2">
                    {row.conversation_id ? (
                      <Link
                        href={`/admin/conversations/${row.conversation_id}`}
                        className="text-accent hover:underline"
                      >
                        {row.trial_user_name ?? '—'}
                      </Link>
                    ) : (
                      row.trial_user_name ?? '—'
                    )}
                  </td>
                  <td className="px-3 py-2">{row.trial_user_email}</td>
                  <td className="px-3 py-2">
                    {format(new Date(row.trial_started_at), 'd MMM yyyy', { locale: es })}
                  </td>
                  <td className="px-3 py-2">
                    {format(new Date(row.trial_ends_at), 'd MMM yyyy', { locale: es })}
                  </td>
                  <td className="px-3 py-2">{row.days_passed}</td>
                  <td className="px-3 py-2">
                    {row.last_message_sent_at
                      ? format(new Date(row.last_message_sent_at), 'd MMM HH:mm', { locale: es })
                      : '—'}
                  </td>
                  <td className="px-3 py-2">{STATUS_LABEL[row.status] ?? row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-bg-border bg-bg-subtle px-4 py-3">
      <p className="text-xs text-fg-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-fg">{value}</p>
    </div>
  );
}

const SURVEY_BREAKDOWN_ORDER: { key: string; label: string }[] = [
  { key: 'price', label: 'Precio' },
  { key: 'features', label: 'Faltan features' },
  { key: 'not_useful', label: 'No me sirvió' },
  { key: 'no_time', label: 'No tuve tiempo' },
  { key: 'not_used', label: 'No la usé' },
];

function SurveySection({
  survey,
  responses,
}: {
  survey: NonNullable<Metrics['survey_30d']>;
  responses: SurveyResponseRow[];
}) {
  return (
    <section className="rounded-lg border border-bg-border bg-bg-subtle/50 p-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-fg">Encuesta día 8 (30d)</h2>
          <p className="text-xs text-fg-muted">
            Post-trial: ¿Qué te faltó para continuar?
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <span>
            <span className="text-fg-muted">Enviadas:</span>{' '}
            <strong>{survey.sent}</strong>
          </span>
          <span>
            <span className="text-fg-muted">Respondidas:</span>{' '}
            <strong>{survey.responded}</strong>
          </span>
          <span>
            <span className="text-fg-muted">Pendientes:</span>{' '}
            <strong>{survey.pending}</strong>
          </span>
          <span>
            <span className="text-fg-muted">Tasa:</span>{' '}
            <strong>{survey.response_rate}%</strong>
          </span>
        </div>
      </div>

      {survey.sent === 0 ? (
        <p className="text-sm text-fg-muted">
          Aún no hay encuestas enviadas en los últimos 30 días.
        </p>
      ) : (
        <>
          <div className="mb-4 grid gap-2 sm:grid-cols-5">
            {SURVEY_BREAKDOWN_ORDER.map(({ key, label }) => (
              <div
                key={key}
                className="rounded-md border border-bg-border bg-bg px-3 py-2 text-center"
              >
                <p className="text-[11px] text-fg-muted">{label}</p>
                <p className="text-lg font-semibold tabular-nums">{survey.breakdown[key] ?? 0}</p>
              </div>
            ))}
          </div>

          {responses.length === 0 ? (
            <p className="text-sm text-fg-muted">Sin respuestas registradas aún.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-bg-border">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-bg-border bg-bg text-fg-muted">
                  <tr>
                    <th className="px-3 py-2">Nombre</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Respuesta</th>
                    <th className="px-3 py-2">Enviada</th>
                  </tr>
                </thead>
                <tbody>
                  {responses.map((row) => (
                    <tr key={row.id} className="border-b border-bg-border/60">
                      <td className="px-3 py-2">
                        {row.conversation_id ? (
                          <Link
                            href={`/admin/conversations/${row.conversation_id}`}
                            className="text-accent hover:underline"
                          >
                            {row.trial_user_name ?? '—'}
                          </Link>
                        ) : (
                          row.trial_user_name ?? '—'
                        )}
                      </td>
                      <td className="px-3 py-2">{row.trial_user_email}</td>
                      <td className="px-3 py-2 font-medium">{row.day_8_response_label}</td>
                      <td className="px-3 py-2">
                        {format(new Date(row.day_8_sent_at), 'd MMM yyyy HH:mm', { locale: es })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
