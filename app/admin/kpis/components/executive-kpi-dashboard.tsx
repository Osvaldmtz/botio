'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  DollarSign,
  FlaskConical,
  Share2,
  Megaphone,
  MessageCircle,
  MousePointerClick,
} from 'lucide-react';
import type { ExecutiveSummaryData } from '@/lib/kpi/utils';
import { KpiLayout } from '@/components/admin/kpis/kpi-layout';
import { KpiEmptyState } from '@/components/admin/kpis/kpi-empty-state';
import { KpiSectionError } from '@/components/admin/kpis/kpi-section-error';
import { RealtimeWidget } from '@/components/admin/kpis/realtime-widget';
import { KpiJarvisAreaChart } from '@/components/admin/kpis/jarvis/kpi-area-chart';
import {
  KpiControlBar,
  type ChartRange,
} from '@/components/admin/kpis/jarvis/kpi-control-bar';
import { KpiHudMetric } from '@/components/admin/kpis/jarvis/kpi-hud-metric';
import { KpiJarvisCanvas, KpiJarvisPanel } from '@/components/admin/kpis/jarvis/kpi-jarvis-theme';

function fmtUsd(value: number | null | undefined): string {
  if (value == null) return '—';
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtNum(value: number | null | undefined): string {
  if (value == null) return '—';
  return value.toLocaleString('en-US');
}

function sliceByRange<T extends { date: string }>(rows: T[], range: ChartRange): T[] {
  return rows.slice(-range);
}

type MetricKey = 'mrr' | 'trials' | 'ig' | 'meta' | 'landing' | 'wa';

type Props = {
  data: ExecutiveSummaryData;
};

export function ExecutiveKpiDashboard({ data }: Props) {
  const router = useRouter();
  const [range, setRange] = useState<ChartRange>(14);
  const [refreshing, setRefreshing] = useState(false);
  const [liveEnabled, setLiveEnabled] = useState(true);
  const [focusMetric, setFocusMetric] = useState<MetricKey | null>(null);

  const waTotal = data.twilio.reduce((sum, r) => sum + (r.total_sent ?? 0), 0);
  const hasAnyData =
    data.kalyo != null ||
    data.twilio.length > 0 ||
    data.igReachDaily.length > 0 ||
    data.landingDaily.length > 0;

  const mrrChart = useMemo(
    () =>
      sliceByRange(data.kalyoHistory, range).map((row) => ({
        date: row.date.slice(5),
        mrr: Number(row.mrr ?? 0),
        subs: Number(row.active_subscribers ?? 0),
      })),
    [data.kalyoHistory, range],
  );

  const igChart = useMemo(
    () =>
      sliceByRange(data.igReachDaily, range).map((row) => ({
        date: row.date.slice(5),
        reach: row.reach,
        impressions: row.impressions,
      })),
    [data.igReachDaily, range],
  );

  const waChart = useMemo(() => {
    const waByDate = new Map<string, number>();
    for (const row of sliceByRange(data.twilio, range)) {
      waByDate.set(row.date, (waByDate.get(row.date) ?? 0) + (row.total_sent ?? 0));
    }
    return Array.from(waByDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({ date: date.slice(5), mensajes: total }));
  }, [data.twilio, range]);

  const landingChart = useMemo(
    () =>
      sliceByRange(data.landingDaily, range).map((row) => ({
        date: row.date.slice(6) + '/' + row.date.slice(4, 6),
        sesiones: row.sessions,
        usuarios: row.users,
      })),
    [data.landingDaily, range],
  );

  const funnelChart = useMemo(() => {
    const last = landingChart.slice(-Math.min(range, 7));
    if (last.length === 0) return [];
    return last.map((row, i) => ({
      date: row.date,
      landing: row.sesiones,
      whatsapp: waChart[i]?.mensajes ?? 0,
    }));
  }, [landingChart, waChart, range]);

  const mrrSpark = mrrChart.map((r) => r.mrr);
  const igSpark = igChart.map((r) => r.reach);
  const waSpark = waChart.map((r) => r.mensajes);

  const sources = [
    { id: 'kalyo', label: 'Kalyo', ok: data.kalyo != null },
    { id: 'meta', label: 'Meta', ok: !data.errors.meta },
    { id: 'ga4', label: 'GA4', ok: !data.errors.ga4 },
    { id: 'ig', label: 'Instagram', ok: !data.errors.instagram },
    { id: 'twilio', label: 'Twilio', ok: data.twilio.length > 0 },
  ];

  async function handleRefresh() {
    setRefreshing(true);
    router.refresh();
    window.setTimeout(() => setRefreshing(false), 1200);
  }

  return (
    <KpiLayout
      title="KPIs"
      subtitle="Centro de comando Jarvis — señales en tiempo real de Kalyo, Meta, GA4 y Twilio"
      jarvis
    >
      <KpiJarvisCanvas>
        <KpiControlBar
          range={range}
          onRangeChange={setRange}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          sources={sources}
          liveEnabled={liveEnabled}
          onLiveToggle={() => setLiveEnabled((v) => !v)}
        />

        {Object.keys(data.errors).length > 0 ? (
          <div className="space-y-2">
            {Object.entries(data.errors).map(([key, msg]) => (
              <KpiSectionError key={key} title={`Error: ${key}`} error={msg} />
            ))}
          </div>
        ) : null}

        <RealtimeWidget enabled={liveEnabled} />

        {!hasAnyData ? (
          <KpiEmptyState variant="jarvis" />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              <KpiHudMetric
                label="MRR"
                value={fmtUsd(data.kalyo?.mrr)}
                icon={DollarSign}
                accent="emerald"
                spark={mrrSpark}
                active={focusMetric === 'mrr'}
                onClick={() => setFocusMetric((m) => (m === 'mrr' ? null : 'mrr'))}
              />
              <KpiHudMetric
                label="Trials"
                value={fmtNum(data.kalyo?.trialing)}
                icon={FlaskConical}
                accent="cyan"
                active={focusMetric === 'trials'}
                onClick={() => setFocusMetric((m) => (m === 'trials' ? null : 'trials'))}
              />
              <KpiHudMetric
                label="IG Reach 7d"
                value={fmtNum(data.igReach7d)}
                icon={Share2}
                accent="violet"
                spark={igSpark}
                active={focusMetric === 'ig'}
                onClick={() => setFocusMetric((m) => (m === 'ig' ? null : 'ig'))}
              />
              <KpiHudMetric
                label="Meta Spend hoy"
                value={fmtUsd(data.metaSpendToday)}
                icon={Megaphone}
                accent="amber"
                active={focusMetric === 'meta'}
                onClick={() => setFocusMetric((m) => (m === 'meta' ? null : 'meta'))}
              />
              <KpiHudMetric
                label="Sesiones Landing"
                value={fmtNum(data.landingSessions30d)}
                hint="30 días"
                icon={MousePointerClick}
                accent="blue"
                active={focusMetric === 'landing'}
                onClick={() => setFocusMetric((m) => (m === 'landing' ? null : 'landing'))}
              />
              <KpiHudMetric
                label="WA Enviados"
                value={fmtNum(waTotal || null)}
                hint="30 días"
                icon={MessageCircle}
                accent="rose"
                spark={waSpark}
                active={focusMetric === 'wa'}
                onClick={() => setFocusMetric((m) => (m === 'wa' ? null : 'wa'))}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <KpiJarvisPanel
                title="Revenue Stream"
                subtitle={`MRR + suscriptores · ventana ${range}d`}
                accent="emerald"
              >
                {mrrChart.length > 0 ? (
                  <KpiJarvisAreaChart
                    data={mrrChart}
                    xKey="date"
                    series={[
                      { dataKey: 'mrr', name: 'MRR USD', color: '#34d399' },
                      { dataKey: 'subs', name: 'Suscriptores', color: '#22d3ee' },
                    ]}
                    height={240}
                  />
                ) : (
                  <KpiEmptyState variant="jarvis" description="Ejecuta /api/cron/kalyo-sync" />
                )}
              </KpiJarvisPanel>

              <KpiJarvisPanel
                title="Social Radar"
                subtitle={`Instagram reach + impresiones · ${range}d`}
                accent="violet"
              >
                {igChart.length > 0 ? (
                  <KpiJarvisAreaChart
                    data={igChart}
                    xKey="date"
                    series={[
                      { dataKey: 'reach', name: 'Reach', color: '#a78bfa' },
                      { dataKey: 'impressions', name: 'Impresiones', color: '#f472b6' },
                    ]}
                    height={240}
                  />
                ) : (
                  <KpiEmptyState variant="jarvis" description="Requiere META_ACCESS_TOKEN" />
                )}
              </KpiJarvisPanel>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <KpiJarvisPanel
                title="WhatsApp Throughput"
                subtitle={`Mensajes enviados por día · ${range}d`}
                accent="rose"
              >
                {waChart.length > 0 ? (
                  <KpiJarvisAreaChart
                    data={waChart}
                    xKey="date"
                    series={[{ dataKey: 'mensajes', name: 'Enviados', color: '#fb7185' }]}
                    height={220}
                  />
                ) : (
                  <KpiEmptyState variant="jarvis" description="Ejecuta /api/cron/twilio-sync" />
                )}
              </KpiJarvisPanel>

              <KpiJarvisPanel
                title="Web Traffic"
                subtitle={`Landing GA4 · sesiones + usuarios · ${range}d`}
                accent="cyan"
              >
                {landingChart.length > 0 ? (
                  <KpiJarvisAreaChart
                    data={landingChart}
                    xKey="date"
                    series={[
                      { dataKey: 'sesiones', name: 'Sesiones', color: '#38bdf8' },
                      { dataKey: 'usuarios', name: 'Usuarios', color: '#2dd4bf' },
                    ]}
                    height={220}
                  />
                ) : (
                  <KpiEmptyState variant="jarvis" description="Requiere GA4 credentials" />
                )}
              </KpiJarvisPanel>
            </div>

            {funnelChart.length > 0 ? (
              <KpiJarvisPanel
                title="Acquisition Funnel"
                subtitle="Landing sessions vs WhatsApp outbound (últimos puntos)"
                accent="amber"
              >
                <KpiJarvisAreaChart
                  data={funnelChart}
                  xKey="date"
                  series={[
                    { dataKey: 'landing', name: 'Sesiones landing', color: '#fbbf24' },
                    { dataKey: 'whatsapp', name: 'Mensajes WA', color: '#34d399' },
                  ]}
                  height={200}
                />
              </KpiJarvisPanel>
            ) : null}
          </>
        )}
      </KpiJarvisCanvas>
    </KpiLayout>
  );
}
