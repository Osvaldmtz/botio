type ConversationFunnelStats = {
  periodDays: number;
  totalConversations: number;
  ghostConversations: number;
  engagedConversations: number;
  leadsCaptured: number;
  followupsSent: number;
  closedConversations: number;
  ghostRate: number;
  engagementRate: number;
  leadRate: number;
};

type Props = {
  stats: ConversationFunnelStats;
};

function pct(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function ConversationMetrics({ stats }: Props) {
  const cards = [
    { label: 'Conversaciones', value: String(stats.totalConversations) },
    { label: 'Fantasma (2 msgs)', value: `${stats.ghostConversations} (${pct(stats.ghostRate)})` },
    { label: 'Engagement (3+ msgs)', value: `${stats.engagedConversations} (${pct(stats.engagementRate)})` },
    { label: 'Leads capturados', value: `${stats.leadsCaptured} (${pct(stats.leadRate)})` },
    { label: 'Follow-ups enviados', value: String(stats.followupsSent) },
    { label: 'Cerradas por guard', value: String(stats.closedConversations) },
  ];

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-medium text-fg-muted">
        Funnel — últimos {stats.periodDays} días
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-bg-border bg-bg-elevated px-4 py-3"
          >
            <p className="text-xs text-fg-muted">{card.label}</p>
            <p className="mt-1 text-lg font-semibold text-fg">{card.value}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-fg-muted">
        Ad → 1er mensaje → 2do mensaje → email → trial → pago. Fantasma = solo 1 intercambio.
      </p>
    </section>
  );
}
