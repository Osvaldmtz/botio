import { ActiveAutomations } from './active-automations';
import { DeliverabilityScore } from './deliverability-score';
import { MetricTiles } from './metric-tiles';
import { PerformanceChart } from './performance-chart';
import { QuickActions } from './quick-actions';
import { ReputationGauge } from './reputation-gauge';
import { ScheduleTimeline } from './schedule-timeline';
import { Card, CardDescription, CardHeader, CardTitle } from './ui/card';

export function KalyoDashboard() {
  return (
    <div className="grid gap-ky-section lg:grid-cols-12">
      {/* Left column */}
      <div className="flex flex-col gap-ky-section lg:col-span-4">
        <QuickActions />
        <ActiveAutomations />
      </div>

      {/* Right column */}
      <div className="flex flex-col gap-ky-section lg:col-span-8">
        <MetricTiles />
        <PerformanceChart />

        <div className="grid gap-ky-section md:grid-cols-3">
          <Card className="flex flex-col">
            <CardHeader>
              <div>
                <CardTitle>Score de Reputación</CardTitle>
                <CardDescription>Salud del dominio de envío</CardDescription>
              </div>
            </CardHeader>
            <ReputationGauge value={85.2} />
            <div className="mt-auto rounded-[10px] bg-ky-positive-bg px-3 py-2 text-ky-sm text-ky-positive">
              Tu reputación de envío está en buen estado. Mantén listas limpias
              y autenticación SPF/DKIM.
            </div>
          </Card>

          <DeliverabilityScore />
          <ScheduleTimeline />
        </div>
      </div>
    </div>
  );
}
