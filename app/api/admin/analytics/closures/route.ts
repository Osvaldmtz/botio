import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  CLOSURE_REASONS,
  CLOSURE_REASON_UI,
  type ClosureReason,
} from '@/lib/conversation-closure-constants';

export const dynamic = 'force-dynamic';

type Row = { closure_reason: string; closed_at: string };

function countByReason(rows: Row[]): Record<ClosureReason, number> {
  const counts = Object.fromEntries(
    CLOSURE_REASONS.map((r) => [r, 0]),
  ) as Record<ClosureReason, number>;
  for (const row of rows) {
    if (CLOSURE_REASONS.includes(row.closure_reason as ClosureReason)) {
      counts[row.closure_reason as ClosureReason] += 1;
    }
  }
  return counts;
}

function buildInsights(topReason: ClosureReason | null, pct: number): string[] {
  const insights: string[] = [];
  if (topReason === 'price' && pct >= 25) {
    insights.push(
      `🔥 ${pct}% de leads perdidos fue por precio. Prioriza trial Max gratis; PRIMER50 solo como último recurso.`,
    );
  }
  if (topReason === 'competition' && pct >= 15) {
    insights.push(
      `⚔️ ${pct}% por competencia. Pídeles que mencionen su sistema actual para analizar.`,
    );
  }
  if (topReason === 'no_response' && pct >= 20) {
    insights.push(
      `👻 ${pct}% dejó de responder. Revisa timing de follow-ups y mensajes de re-engagement.`,
    );
  }
  if (topReason === 'thinking' && pct >= 20) {
    insights.push(
      `🤔 ${pct}% pidió pensarlo. Activa trial gratis en el primer mensaje de objeción.`,
    );
  }
  if (insights.length === 0 && topReason) {
    const ui = CLOSURE_REASON_UI[topReason];
    insights.push(`Razón principal: ${ui.emoji} ${ui.label} (${pct}% del total cerrado).`);
  }
  return insights;
}

export async function GET() {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sixtyDaysAgo = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString();

  const [currentRes, previousRes] = await Promise.all([
    supabase
      .from('conversations')
      .select('closure_reason, closed_at')
      .not('closure_reason', 'is', null)
      .gte('closed_at', thirtyDaysAgo),
    supabase
      .from('conversations')
      .select('closure_reason, closed_at')
      .not('closure_reason', 'is', null)
      .gte('closed_at', sixtyDaysAgo)
      .lt('closed_at', thirtyDaysAgo),
  ]);

  if (currentRes.error) {
    return NextResponse.json({ error: currentRes.error.message }, { status: 500 });
  }
  if (previousRes.error) {
    return NextResponse.json({ error: previousRes.error.message }, { status: 500 });
  }

  const current = (currentRes.data ?? []) as Row[];
  const previous = (previousRes.data ?? []) as Row[];
  const total = current.length;
  const converted = current.filter((r) => r.closure_reason === 'converted').length;
  const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0;

  const currentCounts = countByReason(current);
  const previousCounts = countByReason(previous);

  const distribution = CLOSURE_REASONS.map((reason) => {
    const count = currentCounts[reason];
    const prev = previousCounts[reason];
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const trend =
      prev > 0 ? Math.round(((count - prev) / prev) * 100) : count > 0 ? 100 : 0;
    return {
      reason,
      emoji: CLOSURE_REASON_UI[reason].emoji,
      label: CLOSURE_REASON_UI[reason].label,
      count,
      pct,
      trend_vs_prev_30d: trend,
    };
  }).sort((a, b) => b.count - a.count);

  const topReason = distribution.find((d) => d.count > 0)?.reason ?? null;
  const topPct = topReason ? distribution.find((d) => d.reason === topReason)?.pct ?? 0 : 0;

  return NextResponse.json({
    metrics: {
      total_closed_30d: total,
      conversion_rate_30d: conversionRate,
      top_loss_reason: topReason
        ? {
            reason: topReason,
            label: CLOSURE_REASON_UI[topReason].label,
            emoji: CLOSURE_REASON_UI[topReason].emoji,
            pct: topPct,
          }
        : null,
    },
    distribution,
    insights: buildInsights(topReason, topPct),
    fetchedAt: new Date().toISOString(),
  });
}
