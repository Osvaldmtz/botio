import {
  CalendarPlus,
  FileSpreadsheet,
  LayoutTemplate,
  MoreHorizontal,
  BarChart3,
} from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from './ui/card';
import { cn } from '@/lib/cn';

const ACTIONS = [
  {
    label: 'Nueva Cita',
    icon: CalendarPlus,
    tone: 'bg-ky-accent-light text-ky-accent group-hover:bg-ky-accent group-hover:text-white',
  },
  {
    label: 'Importar Pacientes',
    icon: FileSpreadsheet,
    tone: 'bg-ky-surface-1 text-ky-chart-3 group-hover:bg-ky-chart-3 group-hover:text-white',
  },
  {
    label: 'Diseñar Plantilla',
    icon: LayoutTemplate,
    tone: 'bg-ky-positive-bg text-ky-positive group-hover:bg-ky-positive group-hover:text-white',
  },
  {
    label: 'Ver Reportes',
    icon: BarChart3,
    tone: 'bg-ky-warning-bg text-ky-warning group-hover:bg-ky-warning group-hover:text-white',
  },
] as const;

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Acciones rápidas</CardTitle>
          <CardDescription>
            Elige una acción para avanzar rápido.
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
      <div className="grid grid-cols-2 gap-3">
        {ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            className="group flex flex-col items-center gap-2 rounded-ky-btn border border-ky-border-subtle bg-ky-surface-1 p-4 transition-colors duration-150 hover:border-ky-border"
          >
            <span
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-[10px] transition-colors duration-150',
                action.tone,
              )}
            >
              <action.icon className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <span className="text-center text-ky-sm font-medium text-ky-text-primary">
              {action.label}
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
}
