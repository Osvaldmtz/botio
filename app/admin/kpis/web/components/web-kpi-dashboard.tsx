'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  Clock,
  MousePointerClick,
  ScrollText,
  Search,
  TrendingDown,
  Users,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import type { VividAccent } from '@/components/admin/kpis/vivid/palette';
import type { SearchConsoleMetrics } from '@/lib/search-console-api';
import type { WebPageData } from '@/lib/kpi/utils';
import { KpiEmptyState } from '@/components/admin/kpis/kpi-empty-state';
import { KpiSectionError } from '@/components/admin/kpis/kpi-section-error';
import { KpiVividMetric } from '@/components/admin/kpis/vivid/kpi-vivid-metric';
import { KpiVividPanel } from '@/components/admin/kpis/vivid/kpi-vivid-panel';
import { KpiVividAreaChart, KpiVividBarChart } from '@/components/admin/kpis/vivid/kpi-vivid-charts';
import { KpiVividTable } from '@/components/admin/kpis/vivid/kpi-vivid-table';
import { KpiVividPage, sliceByRange } from '@/components/admin/kpis/vivid/kpi-page-shell';

type Props = { data: WebPageData };
type WebTab = 'ga4' | 'clarity' | 'search-console';

const TABS: { id: WebTab; label: string }[] = [
  { id: 'ga4', label: 'GA4' },
  { id: 'clarity', label: 'Clarity' },
  { id: 'search-console', label: 'Search Console' },
];

function scrollDepthAccent(value: number): VividAccent {
  if (value < 20) return 'rose';
  if (value <= 40) return 'amber';
  return 'emerald';
}

function pctAccent(value: number, badAbove: number): VividAccent {
  return value > badAbove ? 'rose' : 'emerald';
}

function zeroGoodAccent(value: number): VividAccent {
  return value === 0 ? 'emerald' : 'rose';
}

function positionClass(position: number): string {
  if (position < 10) return 'font-semibold text-emerald-600';
  if (position <= 20) return 'font-semibold text-amber-600';
  return 'font-semibold text-rose-600';
}

function shortenPageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    if (path.startsWith('/articulos/')) return path;
    return path || url;
  } catch {
    return url;
  }
}

function WebTabs({ active, onChange }: { active: WebTab; onChange: (tab: WebTab) => void }) {
  return (
    <div className="flex rounded-xl border border-bg-border bg-bg p-1 shadow-sm">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
            active === tab.id
              ? 'bg-[#10B981] text-white shadow-sm'
              : 'text-fg-muted hover:bg-bg-subtle hover:text-fg',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function ClaritySection({ clarity, error }: { clarity: WebPageData['clarity']; error: string | null }) {
  if (error) return <KpiSectionError title="Microsoft Clarity" error={error} />;
  if (!clarity) {
    return (
      <KpiVividPanel title="Microsoft Clarity" accent="violet">
        <KpiEmptyState description="Configura CLARITY_API_TOKEN y CLARITY_PROJECT_ID" />
      </KpiVividPanel>
    );
  }

  return (
    <KpiVividPanel title="Microsoft Clarity" subtitle="Comportamiento en kalyo.io" accent="violet">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiVividMetric label="Sesiones reales" value={clarity.realSessions.toLocaleString()} hint="Bots excluidos" icon={Users} accent="sky" compact />
        <KpiVividMetric label="Sesiones bot" value={clarity.botSessions.toLocaleString()} hint={`${clarity.botRate.toFixed(1)}% del total`} icon={Bot} accent={pctAccent(clarity.botRate, 50)} compact />
        <KpiVividMetric label="Scroll depth" value={`${clarity.scrollDepth.toFixed(1)}%`} icon={ScrollText} accent={scrollDepthAccent(clarity.scrollDepth)} compact />
        <KpiVividMetric label="Tiempo activo" value={`${clarity.activeTimeSec} seg`} icon={Clock} accent="indigo" compact />
        <KpiVividMetric label="Quick backs" value={`${clarity.quickBacks.toFixed(1)}%`} icon={TrendingDown} accent={pctAccent(clarity.quickBacks, 10)} compact />
        <KpiVividMetric label="Rage clicks" value={`${clarity.rageClicks.toFixed(1)}%`} icon={Zap} accent={zeroGoodAccent(clarity.rageClicks)} compact />
        <KpiVividMetric label="Dead clicks" value={`${clarity.deadClicks.toFixed(1)}%`} icon={MousePointerClick} accent={zeroGoodAccent(clarity.deadClicks)} compact />
      </div>
      <p className="mt-4 text-xs text-fg-muted">Datos de los últimos 3 días · Clarity API · Actualizado cada 6h</p>
    </KpiVividPanel>
  );
}

function SearchConsoleEmptyState() {
  return (
    <KpiVividPanel title="Google Search Console" accent="emerald">
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/50 px-6 py-12 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
          <Search className="h-7 w-7" />
        </div>
        <h3 className="text-lg font-semibold text-fg">Search Console conectado</h3>
        <p className="mt-2 max-w-md text-sm text-fg-muted">
          Los datos aparecerán aquí en 24-48 horas. Search Console fue vinculado hoy con GA4.
        </p>
        <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-1.5 text-sm font-medium text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          Vinculación activa · kalyo.io
        </p>
      </div>
    </KpiVividPanel>
  );
}

function SearchConsoleSection({
  metrics,
  loading,
  error,
}: {
  metrics: SearchConsoleMetrics | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <KpiVividPanel title="Google Search Console" accent="emerald">
        <KpiEmptyState description="Cargando datos de Search Console…" />
      </KpiVividPanel>
    );
  }

  if (error) return <KpiSectionError title="Google Search Console" error={error} />;
  if (!metrics || metrics.empty || !metrics.totals) return <SearchConsoleEmptyState />;

  const { totals, keywords, pages } = metrics;

  return (
    <>
      <KpiVividPanel title="Google Search Console" subtitle="Últimos 28 días · kalyo.io" accent="emerald">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiVividMetric label="Total clicks 28d" value={totals.clicks.toLocaleString()} icon={MousePointerClick} accent="emerald" compact />
          <KpiVividMetric label="Total impresiones 28d" value={totals.impressions.toLocaleString()} icon={Search} accent="sky" compact />
          <KpiVividMetric label="CTR promedio" value={`${totals.avgCtr.toFixed(2)}%`} icon={TrendingDown} accent="violet" compact />
          <KpiVividMetric label="Posición promedio" value={`#${totals.avgPosition.toFixed(1)}`} icon={ScrollText} accent={positionClass(totals.avgPosition) === 'font-semibold text-emerald-600' ? 'emerald' : 'amber'} compact />
        </div>
        <p className="mt-4 text-xs text-fg-muted">
          Search Console API · Actualizado {new Date(metrics.updated_at).toLocaleString('es-MX')}
        </p>
      </KpiVividPanel>

      <div className="grid gap-4 xl:grid-cols-2">
        <KpiVividPanel title="Top keywords" accent="sky">
          <KpiVividTable
            rows={keywords}
            rowKey={(row) => row.query}
            columns={[
              { key: 'query', header: 'Keyword', render: (row) => <span className="block max-w-[180px] truncate">{row.query}</span> },
              { key: 'clicks', header: 'Clicks', render: (row) => <span className="tabular-nums">{row.clicks.toLocaleString()}</span> },
              { key: 'impressions', header: 'Impresiones', render: (row) => <span className="tabular-nums">{row.impressions.toLocaleString()}</span> },
              { key: 'ctr', header: 'CTR', render: (row) => <span className="tabular-nums">{row.ctr.toFixed(2)}%</span> },
              { key: 'position', header: 'Posición', render: (row) => <span className={cn('tabular-nums', positionClass(row.position))}>#{row.position.toFixed(1)}</span> },
            ]}
          />
        </KpiVividPanel>

        <KpiVividPanel title="Top páginas" accent="violet">
          <KpiVividTable
            rows={pages}
            rowKey={(row) => row.page}
            columns={[
              { key: 'page', header: 'URL', render: (row) => <span className="block max-w-[200px] truncate font-mono text-xs">{shortenPageUrl(row.page)}</span> },
              { key: 'clicks', header: 'Clicks', render: (row) => <span className="tabular-nums">{row.clicks.toLocaleString()}</span> },
              { key: 'impressions', header: 'Impresiones', render: (row) => <span className="tabular-nums">{row.impressions.toLocaleString()}</span> },
              { key: 'ctr', header: 'CTR', render: (row) => <span className="tabular-nums">{row.ctr.toFixed(2)}%</span> },
              { key: 'position', header: 'Posición', render: (row) => <span className={cn('tabular-nums', positionClass(row.position))}>#{row.position.toFixed(1)}</span> },
            ]}
          />
        </KpiVividPanel>
      </div>
    </>
  );
}

function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function PropertyBlock({
  title,
  accent,
  summary,
  pages,
  daily,
  range,
}: {
  title: string;
  accent: 'emerald' | 'sky' | 'violet' | 'indigo';
  summary: WebPageData['landingSummary'];
  pages: WebPageData['landingPages'];
  daily: WebPageData['landing'];
  range: 7 | 14 | 30;
}) {
  const chartData = useMemo(
    () =>
      sliceByRange(daily, range).map((d) => ({
        date: d.date.slice(5),
        users: d.users,
        sessions: d.sessions,
      })),
    [daily, range],
  );

  return (
    <KpiVividPanel title={title} accent={accent === 'indigo' ? 'violet' : accent}>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiVividMetric label="Usuarios" value={summary.users.toLocaleString()} icon={Users} accent={accent} compact />
        <KpiVividMetric label="Sesiones" value={summary.sessions.toLocaleString()} icon={MousePointerClick} accent={accent} compact />
        <KpiVividMetric label="Engagement" value={`${summary.engagementRate.toFixed(1)}%`} icon={TrendingDown} accent="emerald" compact />
        <KpiVividMetric label="Bounce" value={`${summary.bounceRate.toFixed(1)}%`} icon={TrendingDown} accent="orange" compact />
        <KpiVividMetric label="Duración avg" value={fmtDuration(summary.avgDuration)} icon={Clock} accent="violet" compact />
      </div>
      {chartData.length > 0 ? (
        <KpiVividAreaChart
          data={chartData}
          xKey="date"
          series={[
            { dataKey: 'users', name: 'Usuarios', color: accent === 'emerald' ? '#10B981' : '#6366F1' },
            { dataKey: 'sessions', name: 'Sesiones', color: accent === 'emerald' ? '#0EA5E9' : '#8B5CF6' },
          ]}
          height={200}
        />
      ) : null}
      <div className="mt-4">
        <KpiVividTable
          rows={pages}
          rowKey={(p) => p.pagePath}
          columns={[
            { key: 'path', header: 'Path', render: (p) => <span className="block max-w-xs truncate">{p.pagePath}</span> },
            { key: 'views', header: 'Views', render: (p) => <span className="tabular-nums">{p.screenPageViews.toLocaleString()}</span> },
            { key: 'dur', header: 'Duración', render: (p) => <span className="tabular-nums">{fmtDuration(p.averageSessionDuration)}</span> },
          ]}
        />
      </div>
    </KpiVividPanel>
  );
}

function WebContent({ data, range }: { data: WebPageData; range: 7 | 14 | 30 }) {
  const landing = useMemo(() => sliceByRange(data.landing, range), [data.landing, range]);
  const app = useMemo(() => sliceByRange(data.app, range), [data.app, range]);

  const mergedDates = Array.from(new Set([...landing.map((d) => d.date), ...app.map((d) => d.date)])).sort();
  const landingMap = new Map(landing.map((d) => [d.date, d.users]));
  const appMap = new Map(app.map((d) => [d.date, d.users]));
  const chartData = mergedDates.map((date) => ({
    date: date.slice(5),
    landing: landingMap.get(date) ?? 0,
    app: appMap.get(date) ?? 0,
  }));

  if (data.landing.length === 0 && data.app.length === 0) {
    return <KpiEmptyState description="Configura GOOGLE_CREDENTIALS_JSON" />;
  }

  return (
    <>
      <KpiVividPanel title="Usuarios diarios — Landing vs App" subtitle={`${range}d`} accent="sky">
        {chartData.length > 0 ? (
          <KpiVividBarChart
            data={chartData}
            xKey="date"
            bars={[
              { dataKey: 'landing', name: 'Landing', color: '#10B981' },
              { dataKey: 'app', name: 'App', color: '#6366F1' },
            ]}
            height={260}
          />
        ) : (
          <KpiEmptyState />
        )}
      </KpiVividPanel>

      <div className="grid gap-4 xl:grid-cols-2">
        <PropertyBlock title="Landing · kalyo.io" accent="emerald" summary={data.landingSummary} pages={data.landingPages} daily={data.landing} range={range} />
        <PropertyBlock title="App · app.kalyo.io" accent="indigo" summary={data.appSummary} pages={data.appPages} daily={data.app} range={range} />
      </div>
    </>
  );
}

export function WebKpiDashboard({ data }: Props) {
  const [activeTab, setActiveTab] = useState<WebTab>('ga4');
  const [searchConsole, setSearchConsole] = useState<SearchConsoleMetrics | null>(null);
  const [scLoading, setScLoading] = useState(false);
  const [scError, setScError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab !== 'search-console') return;

    let cancelled = false;
    setScLoading(true);
    setScError(null);

    fetch('/api/kpis/search-console')
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<SearchConsoleMetrics>;
      })
      .then((json) => {
        if (!cancelled) setSearchConsole(json);
      })
      .catch((err) => {
        if (!cancelled) setScError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setScLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const searchConsoleOk = searchConsole != null && !searchConsole.empty && searchConsole.totals != null;

  return (
    <KpiVividPage
      title="Web KPIs"
      subtitle="GA4 Landing vs App"
      sources={[
        { id: 'ga4', label: 'GA4', ok: !data.error && (data.landing.length > 0 || data.app.length > 0) },
        { id: 'clarity', label: 'Clarity', ok: !data.clarityError && data.clarity != null },
        { id: 'search-console', label: 'Search Console', ok: !scError && (searchConsole?.empty === true || searchConsoleOk) },
      ]}
    >
      {({ range }) => (
        <>
          <WebTabs active={activeTab} onChange={setActiveTab} />

          {activeTab === 'ga4' ? (
            <>
              {data.error ? <KpiSectionError title="Google Analytics 4" error={data.error} /> : null}
              <WebContent data={data} range={range} />
            </>
          ) : null}

          {activeTab === 'clarity' ? <ClaritySection clarity={data.clarity} error={data.clarityError} /> : null}

          {activeTab === 'search-console' ? (
            <SearchConsoleSection metrics={searchConsole} loading={scLoading} error={scError} />
          ) : null}
        </>
      )}
    </KpiVividPage>
  );
}
