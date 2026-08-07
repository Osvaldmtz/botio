import { Link2, Mail, MoreHorizontal } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from './ui/card';

const FLOWS = [
  {
    title: 'Serie de Bienvenida',
    meta: '54% · 3 pasos',
    progress: 54,
    icon: Mail,
    iconBg: 'bg-ky-accent-light text-ky-accent',
    bar: 'bg-ky-accent',
  },
  {
    title: 'Reactivación de Trial',
    meta: '27% · tasa de apertura',
    progress: 27,
    icon: Link2,
    iconBg: 'bg-ky-warning-bg text-ky-warning',
    bar: 'bg-ky-chart-2',
  },
] as const;

export function ActiveAutomations() {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div>
          <CardTitle>Automatizaciones activas</CardTitle>
          <CardDescription>
            Flujos de onboarding y winback en curso.
          </CardDescription>
        </div>
        <button
          type="button"
          className="rounded-ky-btn p-1 text-ky-text-muted hover:bg-ky-surface-1"
          aria-label="Más opciones"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </CardHeader>

      <ul className="flex-1 space-y-0">
        {FLOWS.map((flow, i) => (
          <li
            key={flow.title}
            className={
              i > 0 ? 'border-t border-ky-border-subtle pt-4' : 'pb-4'
            }
          >
            <div className="flex items-center gap-3">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${flow.iconBg}`}
              >
                <flow.icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-ky-body font-medium text-ky-text-primary">
                  {flow.title}
                </p>
                <p className="text-ky-sm text-ky-text-secondary">{flow.meta}</p>
              </div>
              <div className="flex h-10 w-12 items-end justify-center gap-0.5">
                {[40, 70, 55, flow.progress, 35].map((h, idx) => (
                  <span
                    key={idx}
                    className={`w-1.5 rounded-sm ${idx === 3 ? flow.bar : 'bg-ky-border'}`}
                    style={{ height: `${Math.max(16, h * 0.35)}px` }}
                  />
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Button variant="nav" className="mt-ky-gap w-full">
        Gestionar Automatizaciones
      </Button>
    </Card>
  );
}
