'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  DollarSign,
  Eye,
  FlaskConical,
  Heart,
  Layers,
  Megaphone,
  MessageCircle,
  MousePointerClick,
  Send,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import type { ExecutiveSummaryData } from '@/lib/kpi/utils';
import { aggregateTwilio } from '@/lib/kpi/utils';
import { KpiLayout } from '@/components/admin/kpis/kpi-layout';
import { KpiEmptyState } from '@/components/admin/kpis/kpi-empty-state';
import { KpiSectionError } from '@/components/admin/kpis/kpi-section-error';
import { RealtimeWidget } from '@/components/admin/kpis/realtime-widget';
import { KpiVividMetric } from '@/components/admin/kpis/vivid/kpi-vivid-metric';
import { KpiVividPanel, KpiVividSectionTitle } from '@/components/admin/kpis/vivid/kpi-vivid-panel';
import {
  KpiVividAreaChart,
  KpiVividBarChart,
  KpiVividLineChart,
  KpiVividPieChart,
} from '@/components/admin/kpis/vivid/kpi-vivid-charts';
import { KpiToolbar, type ChartRange } from '@/components/admin/kpis/vivid/kpi-toolbar';

function fmtUsd(value: number | null | undefined): string {
  if (value == null) return '—';
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtMxn(value: number | null | undefined): string {
  if (value == null) return '—';
  return `$${value.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} MXN`;
}

function fmtNum(value: number | null | undefined): string {
  if (value == null) return '—';
  return value.toLocaleString('en-US');
}

function sliceByRange<T extends { date: string }>(rows: T[], range: ChartRange): T[] {
  return rows.slice(-range);
}

type Props = {
  data: ExecutiveSummaryData;
};

export function ExecutiveKpiDashboard({ data }: Props) {
  const router = useRouter();
  const [range, setRange] = useState<ChartRange>(14);
  const [refreshing, setRefreshing] = useState(false);
  const [liveEnabled, setLiveEnabled] = useState(true);

  const waAgg = useMemo(() => aggregateTwilio(data.twilio), [data.twilio]);
  const deliveryRate =
    waAgg.total_sent > 0 ? ((waAgg.delivered / waAgg.total_sent) * 100).toFixed(1) : '—';

  const igSlice = data.igReachDaily.slice(-7);
  const igImpressions7d = igSlice.reduce((s, p) => s + p.impressions, 0);
  const igEngagement7d = igSlice.reduce((s, p) => s + p.accounts_engaged, 0);
  const igProfileViews7d = igSlice.reduce((s, p) => s + p.profile_views, 0);

  const landingUsers30d = data.landingDaily.reduce((s, r) => s + r.users, 0);
  const avgSessionsDay =
    data.landingDaily.length > 0
      ? Math.round(data.landingDaily.reduce((s, r) => s + r.sessions, 0) / data.landingDaily.length)
      : null;

  const subs = data.kalyo?.active_subscribers ?? 0;
  const mrr = Number(data.kalyo?.mrr ?? 0);
  const arpu = subs > 0 ? mrr / subs : null;
  const costPerMsg =
    waAgg.total_sent > 0 ? waAgg.total_cost_usd / waAgg.total_sent : null;

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
        trials: Number(row.trialing ?? 0),
      })),
    [data.kalyoHistory, range],
  );

  const igChart = useMemo(
    () =>
      sliceByRange(data.igReachDaily, range).map((row) => ({
        date: row.date.slice(5),
        reach: row.reach,
        impressions: row.impressions,
        engagement: row.accounts_engaged,
      })),
    [data.igReachDaily, range],
  );

  const waChart = useMemo(() => {
    const byDate = new Map<string, { sent: number; delivered: number; failed: number; cost: number }>();
    for (const row of sliceByRange(data.twilio, range)) {
      const cur = byDate.get(row.date) ?? { sent: 0, delivered: 0, failed: 0, cost: 0 };
      cur.sent += row.total_sent ?? 0;
      cur.delivered += row.delivered ?? 0;
      cur.failed += row.failed ?? 0;
      cur.cost += Number(row.total_cost_usd ?? 0);
      byDate.set(row.date, cur);
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date: date.slice(5),
        enviados: v.sent,
        entregados: v.delivered,
        fallidos: v.failed,
        costo: Math.round(v.cost * 100) / 100,
        entrega_pct: v.sent > 0 ? Math.round((v.delivered / v.sent) * 1000) / 10 : 0,
      }));
  }, [data.twilio, range]);

  const landingChart = useMemo(
    () =>
      sliceByRange(data.landingDaily, range).map((row) => ({
        date: row.date.slice(5),
        sesiones: row.sessions,
        usuarios: row.users,
        engaged: row.engagedSessions,
      })),
    [data.landingDaily, range],
  );

  const funnelChart = useMemo(() => {
    const dates = Array.from(
      new Set([...waChart.map((r) => r.date), ...landingChart.map((r) => r.date)]),
    ).sort();
    const waMap = new Map(waChart.map((r) => [r.date, r.enviados]));
    const landMap = new Map(landingChart.map((r) => [r.date, r.sesiones]));
    return dates.map((date) => ({
      date,
      landing: landMap.get(date) ?? 0,
      whatsapp: waMap.get(date) ?? 0,
    }));
  }, [waChart, landingChart]);

  const planPie = useMemo(() => {
    const pro = data.kalyo?.plan_pro ?? 0;
    const max = data.kalyo?.plan_max ?? 0;
    if (pro + max === 0) return [];
    return [
      { name: 'Pro', value: pro },
      { name: 'Max', value: max },
    ];
  }, [data.kalyo]);

  const sources = [
    { id: 'kalyo', label: 'Kalyo', ok: data.kalyo != null },
    { id: 'meta', label: 'Meta', ok: !data.errors.meta },
    { id: 'ga4', label: 'GA4', ok: !data.errors.ga4 },
    { id: 'ig', label: 'Instagram', ok: !data.errors.instagram },
    { id: 'twilio', label: 'Twilio', ok: data.twilio.length > 0 },
  ];

  function handleRefresh() {
    setRefreshing(true);
    router.refresh();
    window.setTimeout(() => setRefreshing(false), 1200);
  }

  return (
    <KpiLayout
      title="KPIs"
      subtitle="Panel ejecutivo — revenue, ads, social, web y WhatsApp en un solo lugar"
    >
      <div className="space-y-5">
        <KpiToolbar
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
          <KpiEmptyState />
        ) : (
          <>
            <div>
              <KpiVividSectionTitle accent="emerald">Revenue</KpiVividSectionTitle>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <KpiVividMetric label="MRR" value={fmtUsd(mrr)} icon={DollarSign} accent="emerald" spark={mrrChart.map((r) => r.mrr)} />
                <KpiVividMetric label="Suscriptores" value={fmtNum(subs)} icon={Users} accent="sky" />
                <KpiVividMetric label="Trials" value={fmtNum(data.kalyo?.trialing)} icon={FlaskConical} accent="violet" />
                <KpiVividMetric label="Plan Pro" value={fmtNum(data.kalyo?.plan_pro)} icon={Layers} accent="indigo" />
                <KpiVividMetric label="Plan Max" value={fmtNum(data.kalyo?.plan_max)} icon={Layers} accent="fuchsia" />
                <KpiVividMetric label="ARPU" value={arpu != null ? `$${arpu.toFixed(0)}` : '—'} icon={TrendingUp} accent="amber" hint="MRR / sub" />
              </div>
            </div>

            <div>
              <KpiVividSectionTitle accent="rose">WhatsApp</KpiVividSectionTitle>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <KpiVividMetric label="Enviados" value={fmtNum(waAgg.total_sent)} icon={Send} accent="rose" spark={waChart.map((r) => r.enviados)} />
                <KpiVividMetric label="Entregados" value={fmtNum(waAgg.delivered)} icon={CheckCircle2} accent="emerald" />
                <KpiVividMetric label="Entrega %" value={`${deliveryRate}%`} icon={MessageCircle} accent="sky" />
                <KpiVividMetric label="Fallidos" value={fmtNum(waAgg.failed)} icon={XCircle} accent="orange" />
                <KpiVividMetric label="Costo USD" value={`$${waAgg.total_cost_usd.toFixed(2)}`} icon={DollarSign} accent="amber" />
                <KpiVividMetric label="Costo/msg" value={costPerMsg != null ? `$${costPerMsg.toFixed(3)}` : '—'} icon={TrendingUp} accent="violet" />
              </div>
            </div>

            <div>
              <KpiVividSectionTitle accent="fuchsia">Social & Ads</KpiVividSectionTitle>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <KpiVividMetric label="IG Reach 7d" value={fmtNum(data.igReach7d)} icon={Eye} accent="fuchsia" spark={igChart.map((r) => r.reach)} />
                <KpiVividMetric label="Impresiones 7d" value={fmtNum(igImpressions7d)} icon={Eye} accent="violet" />
                <KpiVividMetric label="Engagement 7d" value={fmtNum(igEngagement7d)} icon={Heart} accent="rose" />
                <KpiVividMetric label="Profile views 7d" value={fmtNum(igProfileViews7d)} icon={Users} accent="indigo" />
                <KpiVividMetric label="Meta Spend hoy" value={fmtMxn(data.metaSpendToday)} icon={Megaphone} accent="orange" />
                <KpiVividMetric label="Sesiones/día avg" value={fmtNum(avgSessionsDay)} icon={MousePointerClick} accent="sky" hint="Landing" />
              </div>
            </div>

            <div>
              <KpiVividSectionTitle accent="sky">Web</KpiVividSectionTitle>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <KpiVividMetric label="Sesiones 30d" value={fmtNum(data.landingSessions30d)} icon={MousePointerClick} accent="sky" spark={landingChart.map((r) => r.sesiones)} />
                <KpiVividMetric label="Usuarios 30d" value={fmtNum(landingUsers30d)} icon={Users} accent="indigo" />
                <KpiVividMetric label="Engaged sessions" value={fmtNum(landingChart.reduce((s, r) => s + r.engaged, 0))} icon={TrendingUp} accent="emerald" hint={`últimos ${range}d`} />
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <KpiVividPanel title="MRR + Suscriptores + Trials" subtitle={`${range} días`} accent="emerald">
                {mrrChart.length > 0 ? (
                  <KpiVividAreaChart
                    data={mrrChart}
                    xKey="date"
                    series={[
                      { dataKey: 'mrr', name: 'MRR USD', color: '#10B981' },
                      { dataKey: 'subs', name: 'Suscriptores', color: '#0EA5E9' },
                      { dataKey: 'trials', name: 'Trials', color: '#8B5CF6' },
                    ]}
                    height={260}
                  />
                ) : (
                  <KpiEmptyState description="Ejecuta /api/cron/kalyo-sync" />
                )}
              </KpiVividPanel>

              <KpiVividPanel title="Mix de planes" subtitle="Pro vs Max activos" accent="violet">
                {planPie.length > 0 ? (
                  <KpiVividPieChart data={planPie} height={260} />
                ) : (
                  <KpiEmptyState />
                )}
              </KpiVividPanel>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <KpiVividPanel title="Instagram" subtitle="Reach, impresiones y engagement" accent="fuchsia">
                {igChart.length > 0 ? (
                  <KpiVividAreaChart
                    data={igChart}
                    xKey="date"
                    series={[
                      { dataKey: 'reach', name: 'Reach', color: '#D946EF' },
                      { dataKey: 'impressions', name: 'Impresiones', color: '#8B5CF6' },
                      { dataKey: 'engagement', name: 'Engagement', color: '#F43F5E' },
                    ]}
                    height={240}
                  />
                ) : (
                  <KpiEmptyState description="Requiere META_ACCESS_TOKEN" />
                )}
              </KpiVividPanel>

              <KpiVividPanel title="Landing GA4" subtitle="Sesiones, usuarios y engaged" accent="sky">
                {landingChart.length > 0 ? (
                  <KpiVividAreaChart
                    data={landingChart}
                    xKey="date"
                    series={[
                      { dataKey: 'sesiones', name: 'Sesiones', color: '#0EA5E9' },
                      { dataKey: 'usuarios', name: 'Usuarios', color: '#6366F1' },
                      { dataKey: 'engaged', name: 'Engaged', color: '#10B981' },
                    ]}
                    height={240}
                  />
                ) : (
                  <KpiEmptyState description="Requiere GA4 credentials" />
                )}
              </KpiVividPanel>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <KpiVividPanel title="WhatsApp — volumen" subtitle="Enviados vs entregados vs fallidos" accent="rose">
                {waChart.length > 0 ? (
                  <KpiVividBarChart
                    data={waChart}
                    xKey="date"
                    stacked
                    bars={[
                      { dataKey: 'entregados', name: 'Entregados', color: '#10B981' },
                      { dataKey: 'fallidos', name: 'Fallidos', color: '#F43F5E' },
                    ]}
                    height={240}
                  />
                ) : (
                  <KpiEmptyState description="Ejecuta /api/cron/twilio-sync" />
                )}
              </KpiVividPanel>

              <KpiVividPanel title="WhatsApp — entrega %" subtitle="Tasa diaria de entrega" accent="emerald">
                {waChart.length > 0 ? (
                  <KpiVividLineChart
                    data={waChart}
                    xKey="date"
                    series={[{ dataKey: 'entrega_pct', name: 'Entrega %', color: '#10B981' }]}
                    height={240}
                  />
                ) : (
                  <KpiEmptyState />
                )}
              </KpiVividPanel>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <KpiVividPanel title="Costo WhatsApp diario" subtitle="USD por día" accent="amber">
                {waChart.length > 0 ? (
                  <KpiVividAreaChart
                    data={waChart}
                    xKey="date"
                    series={[{ dataKey: 'costo', name: 'Costo USD', color: '#F59E0B' }]}
                    height={220}
                  />
                ) : (
                  <KpiEmptyState />
                )}
              </KpiVividPanel>

              {funnelChart.length > 0 ? (
                <KpiVividPanel title="Adquisición" subtitle="Landing sessions vs mensajes WA" accent="indigo">
                  <KpiVividBarChart
                    data={funnelChart}
                    xKey="date"
                    bars={[
                      { dataKey: 'landing', name: 'Sesiones landing', color: '#6366F1' },
                      { dataKey: 'whatsapp', name: 'Mensajes WA', color: '#10B981' },
                    ]}
                    height={220}
                  />
                </KpiVividPanel>
              ) : null}
            </div>
          </>
        )}
      </div>
    </KpiLayout>
  );
}
