type Props = {
  title: string;
  error: string;
  variant?: 'default' | 'jarvis';
};

export function KpiSectionError({ title, error, variant = 'default' }: Props) {
  if (variant === 'jarvis') {
    return (
      <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
        <h3 className="text-sm font-semibold text-amber-200">{title}</h3>
        <p className="mt-1 text-sm text-amber-100/70">{error}</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-semantic-warning/30 bg-semantic-warning/5 p-4">
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      <p className="mt-1 text-sm text-fg-muted">{error}</p>
    </section>
  );
}
