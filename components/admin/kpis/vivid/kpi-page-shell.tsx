'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { KpiLayout } from '@/components/admin/kpis/kpi-layout';
import { KpiToolbar, type ChartRange } from './kpi-toolbar';

export type KpiVividPageContext = { range: ChartRange; refreshing: boolean };

type Props = {
  title: string;
  subtitle: string;
  sources?: Array<{ id: string; label: string; ok: boolean }>;
  children: (ctx: KpiVividPageContext) => ReactNode;
};

export function KpiVividPage({ title, subtitle, sources = [], children }: Props) {
  const router = useRouter();
  const [range, setRange] = useState<ChartRange>(30);
  const [refreshing, setRefreshing] = useState(false);

  function handleRefresh() {
    setRefreshing(true);
    router.refresh();
    window.setTimeout(() => setRefreshing(false), 1200);
  }

  return (
    <KpiLayout title={title} subtitle={subtitle}>
      <div className="space-y-5">
        <KpiToolbar
          range={range}
          onRangeChange={setRange}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          sources={sources}
        />
        {children({ range, refreshing })}
      </div>
    </KpiLayout>
  );
}

export function sliceByRange<T extends { date: string }>(rows: T[], range: ChartRange): T[] {
  return rows.slice(-range);
}
