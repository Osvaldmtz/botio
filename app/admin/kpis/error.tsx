'use client';

import { KpiEmptyState } from '@/components/admin/kpis/kpi-empty-state';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function KpisError({ error, reset }: Props) {
  return (
    <div className="mx-auto max-w-dashboard px-4 py-12 sm:px-6">
      <KpiEmptyState
        title="Error al cargar KPIs"
        description={error.message || 'Ocurrió un error inesperado.'}
      />
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        Reintentar
      </button>
    </div>
  );
}
