import { Card, CardDescription, CardHeader, CardTitle } from './ui/card';

const INDICATORS = [
  { label: 'Quejas de spam', status: 'Bajo', tone: 'bg-ky-negative' },
  { label: 'Tasa de rebote', status: 'Estable', tone: 'bg-ky-positive' },
  { label: 'Autenticación de dominio', status: 'Verificado', tone: 'bg-ky-accent' },
] as const;

export function DeliverabilityScore() {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div>
          <CardTitle>Score de Entregabilidad</CardTitle>
          <CardDescription>Salud de la bandeja de entrada</CardDescription>
        </div>
      </CardHeader>

      <div className="mb-4">
        <p className="font-ky-mono text-ky-display text-ky-text-primary">
          82
          <span className="text-ky-h2 text-ky-text-muted">/100</span>
        </p>
        <p className="mt-1 text-ky-sm text-ky-text-secondary">
          Tu colocación en inbox es saludable.
        </p>
      </div>

      <div className="mb-ky-gap h-2.5 overflow-hidden rounded-ky-badge bg-ky-border-subtle">
        <div
          className="h-full rounded-ky-badge bg-ky-accent"
          style={{ width: '82%' }}
        />
      </div>

      <div>
        <p className="mb-3 text-ky-caption uppercase tracking-wide text-ky-text-muted">
          Indicadores
        </p>
        <ul className="space-y-2.5">
          {INDICATORS.map((item) => (
            <li
              key={item.label}
              className="flex items-center justify-between text-ky-sm"
            >
              <span className="inline-flex items-center gap-2 text-ky-text-primary">
                <span className={`h-2 w-2 rounded-full ${item.tone}`} />
                {item.label}
              </span>
              <span className="font-medium text-ky-text-secondary">
                {item.status}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
