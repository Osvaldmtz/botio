type Props = {
  title: string;
  error: string;
};

export function KpiSectionError({ title, error }: Props) {
  return (
    <section className="rounded-lg border border-semantic-warning/30 bg-semantic-warning/5 p-4">
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      <p className="mt-1 text-sm text-fg-muted">{error}</p>
    </section>
  );
}
