import { CalendarRange } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from './ui/card';

const HOURS = ['07:00', '07:15', '07:30', '07:45', '08:00', '08:15', '08:30'];

const EVENTS = [
  {
    day: 'Hoy',
    title: 'Campaña Welcome',
    time: '07:00 – 07:45',
    colStart: 1,
    colSpan: 3,
    tone: 'border-l-[3px] border-l-ky-accent bg-ky-accent-light text-ky-accent-dark',
  },
  {
    day: 'Dom 8 febrero',
    title: 'Recordatorio citas',
    time: '07:30 – 08:15',
    colStart: 3,
    colSpan: 3,
    tone: 'border border-ky-border bg-ky-surface-1 text-ky-text-primary',
  },
] as const;

export function ScheduleTimeline() {
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader>
        <div>
          <CardTitle>Programar Campaña</CardTitle>
          <CardDescription>Agenda de envíos clínicos</CardDescription>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-ky-badge border border-ky-border px-2.5 py-1 font-ky-mono text-ky-caption text-ky-text-secondary hover:bg-ky-surface-1"
        >
          <CalendarRange className="h-3.5 w-3.5" />
          7 Feb – 10 Feb
        </button>
      </CardHeader>

      <div className="mb-3 grid grid-cols-7 gap-1">
        {HOURS.map((h) => (
          <span
            key={h}
            className="text-center font-ky-mono text-[10px] text-ky-text-muted"
          >
            {h}
          </span>
        ))}
      </div>

      <div className="space-y-3">
        {EVENTS.map((event) => (
          <div key={event.title}>
            <p className="mb-1.5 text-ky-caption text-ky-text-muted">
              {event.day}
            </p>
            <div className="grid grid-cols-7 gap-1">
              <div
                className={`rounded-[10px] px-2.5 py-2 ${event.tone}`}
                style={{
                  gridColumn: `${event.colStart} / span ${event.colSpan}`,
                }}
              >
                <p className="truncate text-ky-sm font-medium">{event.title}</p>
                <p className="font-ky-mono text-[10px] opacity-80">
                  {event.time}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
