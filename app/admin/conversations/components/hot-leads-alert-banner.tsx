'use client';

type Props = {
  count: number;
  onFilter: () => void;
};

export function HotLeadsAlertBanner({ count, onFilter }: Props) {
  if (count <= 0) return null;

  return (
    <button
      type="button"
      onClick={onFilter}
      className="w-full rounded-lg border border-semantic-hot/30 bg-semantic-hot-bg px-4 py-3 text-left transition-colors hover:bg-semantic-hot-bg/80"
    >
      <p className="text-sm font-semibold text-semantic-hot">
        🔥 HOT Leads sin atender (últimas 24h): {count}
      </p>
      <p className="mt-0.5 text-xs text-fg-muted">
        Click para ver solo leads HOT que esperan respuesta humana
      </p>
    </button>
  );
}
