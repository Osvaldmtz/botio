'use client';

import { useMemo } from 'react';
import {
  CalendarCheck,
  LayoutTemplate,
  MessageCircle,
  MousePointerClick,
  Percent,
  Sparkles,
  Eye,
  Megaphone,
} from 'lucide-react';
import type { LandingCtasPageData } from '@/lib/kpi/utils';
import type { CtaEventName } from '@/lib/cta-events-queries';
import { KpiEmptyState } from '@/components/admin/kpis/kpi-empty-state';
import { KpiSectionError } from '@/components/admin/kpis/kpi-section-error';
import { KpiVividMetric } from '@/components/admin/kpis/vivid/kpi-vivid-metric';
import { KpiVividPanel } from '@/components/admin/kpis/vivid/kpi-vivid-panel';
import { KpiVividAreaChart, KpiVividBarChart } from '@/components/admin/kpis/vivid/kpi-vivid-charts';
import { KpiVividTable } from '@/components/admin/kpis/vivid/kpi-vivid-table';
import { KpiVividPage, sliceByRange } from '@/components/admin/kpis/vivid/kpi-page-shell';

type Props = { data: LandingCtasPageData };

const EVENT_LABELS: Record<CtaEventName, string> = {
  cta_demo_hero: 'Demo Hero',
  cta_demo_section: 'Demo Section',
  cta_whatsapp_landing: 'WhatsApp',
  cta_demo_confirmed: 'Demo Confirmada',
};

function sumMetaField(rows: LandingCtasPageData['metaAds'], field: 'impressions' | 'reach' | 'clicks') {
  return rows.reduce((acc, row) => acc + Number(row[field] || 0), 0);
}

export function LandingCtasDashboard({ data }: Props) {
  const hasCtaData = data.cta.totalEvents > 0;

  return (
    <KpiVividPage
      title="CTAs Landing Kalyo"
      subtitle="Clicks en kalyo.io — GA4/Meta en sitio + ingestión propia en Botio"
      sources={[
        { id: 'cta', label: 'CTA Events', ok: hasCtaData },
        { id: 'meta_ads', label: 'Meta Ads', ok: !data.metaAdsError && data.metaAds.length > 0 },
        { id: 'meta_pixel', label: 'Meta Pixel', ok: !data.metaPixelError && data.metaPixelEvents.length > 0 },
      ]}
    >
      {({ range }) => (
        <>
          <CtaSection data={data} range={range} />
          <MetaSection data={data} />
        </>
      )}
    </KpiVividPage>
  );
}

function sumCountsFromDaily(daily: LandingCtasPageData['cta']['daily']): LandingCtasPageData['cta']['counts'] {
  return daily.reduce(
    (acc, row) => ({
      cta_demo_hero: acc.cta_demo_hero + row.cta_demo_hero,
      cta_demo_section: acc.cta_demo_section + row.cta_demo_section,
      cta_whatsapp_landing: acc.cta_whatsapp_landing + row.cta_whatsapp_landing,
      cta_demo_confirmed: acc.cta_demo_confirmed + row.cta_demo_confirmed,
    }),
    {
      cta_demo_hero: 0,
      cta_demo_section: 0,
      cta_whatsapp_landing: 0,
      cta_demo_confirmed: 0,
    },
  );
}

function CtaSection({ data, range }: { data: LandingCtasPageData; range: 7 | 14 | 30 }) {
  const daily = useMemo(() => sliceByRange(data.cta.daily, range), [data.cta.daily, range]);
  const counts = useMemo(() => sumCountsFromDaily(daily), [daily]);
  const conversion =
    counts.cta_demo_hero + counts.cta_demo_section > 0
      ? `${((counts.cta_demo_confirmed / (counts.cta_demo_hero + counts.cta_demo_section)) * 100).toFixed(1)}%`
      : '—';
  const totalEvents = useMemo(
    () =>
      counts.cta_demo_hero +
      counts.cta_demo_section +
      counts.cta_whatsapp_landing +
      counts.cta_demo_confirmed,
    [counts],
  );

  const chartData = daily.map((row) => ({
    date: row.date.slice(5),
    hero: row.cta_demo_hero,
    section: row.cta_demo_section,
    whatsapp: row.cta_whatsapp_landing,
    confirmed: row.cta_demo_confirmed,
  }));

  if (totalEvents === 0) {
    return (
      <KpiEmptyState description="Sin eventos CTA aún. Verifica que kalyo.io esté enviando a /api/cta-track." />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiVividMetric
          label="Demo Hero"
          value={counts.cta_demo_hero.toLocaleString()}
          icon={LayoutTemplate}
          accent="sky"
          spark={chartData.map((d) => d.hero)}
        />
        <KpiVividMetric
          label="Demo Section"
          value={counts.cta_demo_section.toLocaleString()}
          icon={MousePointerClick}
          accent="indigo"
          spark={chartData.map((d) => d.section)}
        />
        <KpiVividMetric
          label="WhatsApp"
          value={counts.cta_whatsapp_landing.toLocaleString()}
          icon={MessageCircle}
          accent="emerald"
          spark={chartData.map((d) => d.whatsapp)}
        />
        <KpiVividMetric
          label="Demo Confirmada"
          value={counts.cta_demo_confirmed.toLocaleString()}
          icon={CalendarCheck}
          accent="amber"
          spark={chartData.map((d) => d.confirmed)}
        />
        <KpiVividMetric
          label="Conv. demo"
          value={conversion}
          hint="confirmada / (hero + section)"
          icon={Percent}
          accent="rose"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <KpiVividPanel title="CTAs por día" subtitle={`${range}d`} accent="sky">
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
        <KpiVividPanel title="Totales por evento" accent="indigo">
          <KpiVividBarChart
            data={[
              { event: 'Hero', count: counts.cta_demo_hero },
              { event: 'Section', count: counts.cta_demo_section },
              { event: 'WhatsApp', count: counts.cta_whatsapp_landing },
              { event: 'Confirmada', count: counts.cta_demo_confirmed },
            ]}
            xKey="event"
            bars={[{ dataKey: 'count', name: 'Clicks', color: '#6366F1' }]}
            height={240}
          />
        </KpiVividPanel>
      </div>

      <KpiVividPanel title="Desglose" accent="emerald">
        <KpiVividTable
          rowKey={(row) => row.event}
          columns={[
            { key: 'event', header: 'Evento', render: (row) => row.event },
            {
              key: 'count',
              header: `Total ${range}d`,
              className: 'text-right tabular-nums',
              render: (row) => row.count,
            },
          ]}
          rows={(Object.keys(EVENT_LABELS) as CtaEventName[]).map((key) => ({
            event: EVENT_LABELS[key],
            count: counts[key].toLocaleString(),
          }))}
        />
      </KpiVividPanel>
    </div>
  );
}

function MetaSection({ data }: { data: LandingCtasPageData }) {
  const impressions = sumMetaField(data.metaAds, 'impressions');
  const reach = sumMetaField(data.metaAds, 'reach');
  const clicks = sumMetaField(data.metaAds, 'clicks');

  const ctaPixelEvents = data.metaPixelEvents.filter((row) =>
    row.event.startsWith('cta_'),
  );

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
              {
                key: 'count',
                header: 'Conteo',
                className: 'text-right tabular-nums',
                render: (row) => row.count,
              },
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
