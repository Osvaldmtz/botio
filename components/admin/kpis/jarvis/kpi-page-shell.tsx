'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { KpiLayout } from '@/components/admin/kpis/kpi-layout';
import { KpiJarvisCanvas } from './kpi-jarvis-theme';
import { KpiControlBar, type ChartRange } from './kpi-control-bar';

export type KpiJarvisPageContext = {
  range: ChartRange;
  refreshing: boolean;
};

type SourceStatus = {
  id: string;
  label: string;
  ok: boolean;
};

type Props = {
  title: string;
  subtitle: string;
  sources?: SourceStatus[];
  children: (ctx: KpiJarvisPageContext) => ReactNode;
};

export function KpiJarvisPage({ title, subtitle, sources = [], children }: Props) {
  const router = useRouter();
  const [range, setRange] = useState<ChartRange>(30);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    router.refresh();
    window.setTimeout(() => setRefreshing(false), 1200);
  }

  return (
    <KpiLayout title={title} subtitle={subtitle} jarvis>
      <KpiJarvisCanvas>
        <KpiControlBar
          range={range}
          onRangeChange={setRange}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          sources={sources}
        />
        {children({ range, refreshing })}
      </KpiJarvisCanvas>
    </KpiLayout>
  );
}

export function sliceByRange<T extends { date: string }>(rows: T[], range: ChartRange): T[] {
  return rows.slice(-range);
}
