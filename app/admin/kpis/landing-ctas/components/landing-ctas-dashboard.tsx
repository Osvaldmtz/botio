'use client';

import { useMemo, useState } from 'react';
import {
  CalendarCheck,
  LayoutTemplate,
  MessageCircle,
  MousePointerClick,
  Percent,
  Sparkles,
  Eye,
  Megaphone,
  DollarSign,
  Smartphone,
  Globe,
  Mic,
  UserPlus,
  FlaskConical,
  FileText,
  Crown,
} from 'lucide-react';
import type { LandingCtasPageData } from '@/lib/kpi/utils';
import {
  APP_CTA_EVENTS,
  CTA_EVENT_LABELS,
  LANDING_CTA_EVENTS,
  type AppCtaEventName,
  type CtaEventsSummary,
  type CtaSourceFilter,
  sumCountsFromDaily,
  sumValueFromDaily,
} from '@/lib/cta-events-utils';
import { KpiEmptyState } from '@/components/admin/kpis/kpi-empty-state';
import { KpiSectionError } from '@/components/admin/kpis/kpi-section-error';
import { KpiVividMetric } from '@/components/admin/kpis/vivid/kpi-vivid-metric';
import { KpiVividPanel } from '@/components/admin/kpis/vivid/kpi-vivid-panel';
import { KpiVividAreaChart, KpiVividBarChart } from '@/components/admin/kpis/vivid/kpi-vivid-charts';
import { KpiVividTable } from '@/components/admin/kpis/vivid/kpi-vivid-table';
import { KpiVividPage } from '@/components/admin/kpis/vivid/kpi-page-shell';
import type { ChartRange } from '@/components/admin/kpis/vivid/kpi-toolbar';
import { cn } from '@/lib/cn';

type Props = { data: LandingCtasPageData };

const SOURCE_FILTERS: Array<{ id: CtaSourceFilter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'landing', label: 'Landing' },
  { id: 'app', label: 'App' },
];

const APP_EVENT_ICONS: Record<AppCtaEventName, typeof Crown> = {
  cta_plan_pro: Crown,
  cta_plan_max: Crown,
  cta_plan_ultra: Crown,
  cta_kaly_voice_used: Mic,
  cta_first_patient: UserPlus,
  cta_first_test: FlaskConical,
  cta_first_report: FileText,
};

function formatUsd(value: number) {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function sumMetaField(rows: LandingCtasPageData['metaAds'], field: 'impressions' | 'reach' | 'clicks') {
  return rows.reduce((acc, row) => acc + Number(row[field] || 0), 0);
}

function sliceSummary(summary: CtaEventsSummary, range: ChartRange): CtaEventsSummary {
  const daily = summary.daily.slice(-range);
  const counts = sumCountsFromDaily(daily);
  const conversion =
    counts.cta_demo_hero + counts.cta_demo_section > 0
      ? (counts.cta_demo_confirmed / (counts.cta_demo_hero + counts.cta_demo_section)) * 100
      : null;

  return {
    counts,
    daily,
    conversionRate: conversion,
    totalEvents: Object.values(counts).reduce((acc, n) => acc + n, 0),
    totalValueUsd: sumValueFromDaily(daily),
  };
}

export function LandingCtasDashboard({ data }: Props) {
  const [sourceFilter, setSourceFilter] = useState<CtaSourceFilter>('all');
  const hasCtaData = data.cta.all.totalEvents > 0;

  return (
    <KpiVividPage
      title="CTAs Kalyo"
      subtitle="Landing kalyo.io + app.kalyo.io — pipeline propio Botio (sin GA4 API)"
      ranges={[7, 30, 90]}
      sources={[
        { id: 'cta', label: 'CTA Events', ok: hasCtaData },
        { id: 'meta_ads', label: 'Meta Ads', ok: !data.metaAdsError && data.metaAds.length > 0 },
        { id: 'meta_pixel', label: 'Meta Pixel', ok: !data.metaPixelError && data.metaPixelEvents.length > 0 },
      ]}
    >
      {({ range }) => (
        <>
          <SourceFilterBar value={sourceFilter} onChange={setSourceFilter} />
          <OverviewSection data={data} range={range} sourceFilter={sourceFilter} />
          <LandingSection data={data} range={range} />
          <AppSection data={data} range={range} />
          <PlanComparisonSection data={data} range={range} />
          <MetaSection data={data} />
        </>
      )}
    </KpiVividPage>
  );
}

function SourceFilterBar({
  value,
  onChange,
}: {
  value: CtaSourceFilter;
  onChange: (value: CtaSourceFilter) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {SOURCE_FILTERS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={cn(
            'rounded-full px-4 py-1.5 text-xs font-semibold transition-colors',
            value === item.id
              ? 'bg-[#22C55E] text-white shadow-sm'
              : 'border border-bg-border bg-bg text-fg-muted hover:text-fg',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function OverviewSection({
  data,
  range,
  sourceFilter,
}: {
  data: LandingCtasPageData;
  range: ChartRange;
  sourceFilter: CtaSourceFilter;
}) {
  const summary = useMemo(() => {
    const base =
      sourceFilter === 'landing'
        ? data.cta.landing
        : sourceFilter === 'app'
          ? data.cta.app
          : data.cta.all;
    return sliceSummary(base, range);
  }, [data.cta, range, sourceFilter]);

  if (summary.totalEvents === 0) {
    return (
      <KpiEmptyState description="Sin eventos CTA en el rango. Verifica kalyo.io y app.kalyo.io enviando a /api/cta-track." />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <KpiVividMetric
        label="Total eventos"
        value={summary.totalEvents.toLocaleString()}
        hint={`${range}d · ${sourceFilter}`}
        icon={MousePointerClick}
        accent="sky"
      />
      <KpiVividMetric
        label="Valor generado"
        value={formatUsd(summary.totalValueUsd)}
        hint="SUM value_usd"
        icon={DollarSign}
        accent="emerald"
      />
      <KpiVividMetric
        label="Conv. demo"
        value={
          summary.conversionRate != null ? `${summary.conversionRate.toFixed(1)}%` : '—'
        }
        hint="confirmada / (hero + section)"
        icon={Percent}
        accent="rose"
      />
    </div>
  );
}

function LandingSection({ data, range }: { data: LandingCtasPageData; range: ChartRange }) {
  const summary = useMemo(() => sliceSummary(data.cta.landing, range), [data.cta.landing, range]);
  const counts = summary.counts;
  const totalEvents = LANDING_CTA_EVENTS.reduce((acc, key) => acc + counts[key], 0);

  if (totalEvents === 0) return null;

  const chartData = summary.daily.map((row) => ({
    date: row.date.slice(5),
    hero: row.cta_demo_hero,
    section: row.cta_demo_section,
    whatsapp: row.cta_whatsapp_landing,
    confirmed: row.cta_demo_confirmed,
  }));

  const conversion =
    counts.cta_demo_hero + counts.cta_demo_section > 0
      ? `${((counts.cta_demo_confirmed / (counts.cta_demo_hero + counts.cta_demo_section)) * 100).toFixed(1)}%`
      : '—';

  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-fg-muted">
        <Globe className="h-4 w-4" />
        Landing CTAs
      </h3>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiVividMetric label="Demo Hero" value={counts.cta_demo_hero.toLocaleString()} icon={LayoutTemplate} accent="sky" spark={chartData.map((d) => d.hero)} />
        <KpiVividMetric label="Demo Section" value={counts.cta_demo_section.toLocaleString()} icon={MousePointerClick} accent="indigo" spark={chartData.map((d) => d.section)} />
        <KpiVividMetric label="WhatsApp" value={counts.cta_whatsapp_landing.toLocaleString()} icon={MessageCircle} accent="emerald" spark={chartData.map((d) => d.whatsapp)} />
        <KpiVividMetric label="Demo Confirmada" value={counts.cta_demo_confirmed.toLocaleString()} icon={CalendarCheck} accent="amber" spark={chartData.map((d) => d.confirmed)} />
        <KpiVividMetric label="Conv. demo" value={conversion} hint="confirmada / (hero + section)" icon={Percent} accent="rose" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <KpiVividPanel title="Landing por día" subtitle={`${range}d`} accent="sky">
          <KpiVividAreaChart
            data={chartData}
            xKey="date"
            series={[
              { dataKey: 'hero', name: 'Hero', color: '#0EA5E9' },
              { dataKey: 'section', name: 'Section', color: '#6366F1' },
              { dataKey: 'whatsapp', name: 'WhatsApp', color: '#10B981' },
              { dataKey: 'confirmed', name: 'Confirmada', color: '#F59E0B' },
            ]}
            height={240}
          />
        </KpiVividPanel>
        <KpiVividPanel title="Valor landing" accent="emerald">
          <KpiVividMetric label="Valor generado" value={formatUsd(summary.totalValueUsd)} icon={DollarSign} accent="emerald" />
        </KpiVividPanel>
      </div>

      <KpiVividPanel title="Desglose landing" accent="emerald">
        <KpiVividTable
          rowKey={(row) => row.event}
          columns={[
            { key: 'event', header: 'Evento', render: (row) => row.event },
            { key: 'count', header: `Total ${range}d`, className: 'text-right tabular-nums', render: (row) => row.count },
          ]}
          rows={LANDING_CTA_EVENTS.map((key) => ({
            event: CTA_EVENT_LABELS[key],
            count: counts[key].toLocaleString(),
          }))}
        />
      </KpiVividPanel>
    </div>
  );
}

function AppSection({ data, range }: { data: LandingCtasPageData; range: ChartRange }) {
  const summary = useMemo(() => sliceSummary(data.cta.app, range), [data.cta.app, range]);
  const counts = summary.counts;
  const totalEvents = APP_CTA_EVENTS.reduce((acc, key) => acc + counts[key], 0);

  if (totalEvents === 0) {
    return (
      <div className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-fg-muted">
          <Smartphone className="h-4 w-4" />
          App CTAs
        </h3>
        <KpiEmptyState description="Sin eventos de app.kalyo.io aún." />
      </div>
    );
  }

  const chartData = summary.daily.map((row) => ({
    date: row.date.slice(5),
    pro: row.cta_plan_pro,
    max: row.cta_plan_max,
    ultra: row.cta_plan_ultra,
    voice: row.cta_kaly_voice_used,
    patient: row.cta_first_patient,
    test: row.cta_first_test,
    report: row.cta_first_report,
  }));

  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-fg-muted">
        <Smartphone className="h-4 w-4" />
        App CTAs
      </h3>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {APP_CTA_EVENTS.map((key) => {
          const Icon = APP_EVENT_ICONS[key];
          return (
            <KpiVividMetric
              key={key}
              label={CTA_EVENT_LABELS[key]}
              value={counts[key].toLocaleString()}
              icon={Icon}
              accent={key.startsWith('cta_plan_') ? 'amber' : 'violet'}
            />
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <KpiVividPanel title="App por día" subtitle={`${range}d`} accent="violet">
          <KpiVividAreaChart
            data={chartData}
            xKey="date"
            series={[
              { dataKey: 'pro', name: 'Pro', color: '#8B5CF6' },
              { dataKey: 'max', name: 'Max', color: '#F59E0B' },
              { dataKey: 'voice', name: 'Voz', color: '#10B981' },
              { dataKey: 'patient', name: 'Paciente', color: '#0EA5E9' },
            ]}
            height={240}
          />
        </KpiVividPanel>
        <KpiVividPanel title="Valor app" accent="amber">
          <KpiVividMetric label="Valor generado" value={formatUsd(summary.totalValueUsd)} icon={DollarSign} accent="amber" />
        </KpiVividPanel>
      </div>

      <KpiVividPanel title="Desglose app" accent="violet">
        <KpiVividTable
          rowKey={(row) => row.event}
          columns={[
            { key: 'event', header: 'Evento', render: (row) => row.event },
            { key: 'count', header: `Total ${range}d`, className: 'text-right tabular-nums', render: (row) => row.count },
          ]}
          rows={APP_CTA_EVENTS.map((key) => ({
            event: CTA_EVENT_LABELS[key],
            count: counts[key].toLocaleString(),
          }))}
        />
      </KpiVividPanel>
    </div>
  );
}

function PlanComparisonSection({ data, range }: { data: LandingCtasPageData; range: ChartRange }) {
  const landing = useMemo(() => sliceSummary(data.cta.landing, range), [data.cta.landing, range]);
  const app = useMemo(() => sliceSummary(data.cta.app, range), [data.cta.app, range]);

  const comparisonRows = (['cta_plan_pro', 'cta_plan_max', 'cta_plan_ultra'] as const).map((event) => {
    const landingCount = landing.counts[event];
    const appCount = app.counts[event];
    const unit = event === 'cta_plan_pro' ? 29 : event === 'cta_plan_max' ? 39 : 69;
    return {
      plan: CTA_EVENT_LABELS[event],
      landing: landingCount,
      app: appCount,
      landingValue: formatUsd(landingCount * unit),
      appValue: formatUsd(appCount * unit),
    };
  });

  const hasPlans = comparisonRows.some((row) => row.landing > 0 || row.app > 0);
  if (!hasPlans) return null;

  return (
    <KpiVividPanel title="Planes: Landing vs App" subtitle={`${range}d`} accent="indigo">
      <KpiVividTable
        rowKey={(row) => row.plan}
        columns={[
          { key: 'plan', header: 'Plan', render: (row) => row.plan },
          { key: 'landing', header: 'Landing clicks', className: 'text-right tabular-nums', render: (row) => row.landing },
          { key: 'app', header: 'App clicks', className: 'text-right tabular-nums', render: (row) => row.app },
          { key: 'landingValue', header: 'Valor landing', className: 'text-right tabular-nums', render: (row) => row.landingValue },
          { key: 'appValue', header: 'Valor app', className: 'text-right tabular-nums', render: (row) => row.appValue },
        ]}
        rows={comparisonRows}
      />
      <div className="mt-4">
        <KpiVividBarChart
          data={comparisonRows.map((row) => ({ plan: row.plan.replace('Plan ', ''), landing: row.landing, app: row.app }))}
          xKey="plan"
          bars={[
            { dataKey: 'landing', name: 'Landing', color: '#0EA5E9' },
            { dataKey: 'app', name: 'App', color: '#8B5CF6' },
          ]}
          height={220}
        />
      </div>
    </KpiVividPanel>
  );
}

function MetaSection({ data }: { data: LandingCtasPageData }) {
  const impressions = sumMetaField(data.metaAds, 'impressions');
  const reach = sumMetaField(data.metaAds, 'reach');
  const clicks = sumMetaField(data.metaAds, 'clicks');

  const ctaPixelEvents = data.metaPixelEvents.filter((row) => row.event.startsWith('cta_'));

  if (data.metaAdsError) {
    return <KpiSectionError title="Meta Ads API" error={data.metaAdsError} />;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-fg-muted">
        Meta Pixel 3356117344562696
      </h3>

      {data.metaPixelError ? (
        <KpiSectionError title="Meta Pixel Stats" error={data.metaPixelError} />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiVividMetric label="Impresiones Ads" value={impressions.toLocaleString()} icon={Eye} accent="violet" />
        <KpiVividMetric label="Alcance Ads" value={reach.toLocaleString()} icon={Megaphone} accent="fuchsia" />
        <KpiVividMetric label="Clicks Ads" value={clicks.toLocaleString()} icon={MousePointerClick} accent="amber" />
        <KpiVividMetric
          label="Eventos Pixel CTA"
          value={ctaPixelEvents.reduce((sum, row) => sum + row.count, 0).toLocaleString()}
          icon={Sparkles}
          accent="sky"
        />
      </div>

      {data.metaPixelEvents.length > 0 ? (
        <KpiVividPanel title="Eventos Pixel (30d)" accent="violet">
          <KpiVividTable
            rowKey={(row) => row.event}
            columns={[
              { key: 'event', header: 'Evento', render: (row) => row.event },
              { key: 'count', header: 'Conteo', className: 'text-right tabular-nums', render: (row) => row.count },
            ]}
            rows={data.metaPixelEvents.slice(0, 15).map((row) => ({
              event: row.event,
              count: row.count.toLocaleString(),
            }))}
          />
        </KpiVividPanel>
      ) : null}
    </div>
  );
}
