'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, RefreshCw, Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { KpiInsightsData } from '@/lib/kpi/insights-types';
import { KpiVividPage } from '@/components/admin/kpis/vivid/kpi-page-shell';
import { KpiVividPanel } from '@/components/admin/kpis/vivid/kpi-vivid-panel';
import { VIVID, type VividAccent } from '@/components/admin/kpis/vivid/palette';

type Props = { data: KpiInsightsData };

type InsightSection = {
  id: string;
  emoji: string;
  title: string;
  accent: VividAccent;
  match: string;
};

const SECTIONS: InsightSection[] = [
  { id: 'working', emoji: '✅', title: 'Lo que está funcionando', accent: 'emerald', match: 'Lo que está funcionando' },
  { id: 'alerts', emoji: '⚠️', title: 'Alertas y problemas detectados', accent: 'amber', match: 'Alertas y problemas detectados' },
  { id: 'actions', emoji: '🎯', title: 'Top 3 acciones esta semana', accent: 'violet', match: 'Top 3 acciones esta semana' },
  { id: 'projection', emoji: '📈', title: 'Proyección a 30 días', accent: 'sky', match: 'Proyección a 30 días' },
];

function parseSections(markdown: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!markdown.trim()) return result;
  const chunks = markdown.split(/^##\s+/m).slice(1);
  for (const chunk of chunks) {
    const newline = chunk.indexOf('\n');
    const header = newline === -1 ? chunk.trim() : chunk.slice(0, newline).trim();
    const body = newline === -1 ? '' : chunk.slice(newline + 1).trim();
    for (const section of SECTIONS) {
      if (header.includes(section.match)) result[section.id] = body;
    }
  }
  return result;
}

function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className="font-semibold text-fg">{part.slice(2, -2)}</strong>
    ) : (
      part
    ),
  );
}

function MarkdownBody({ text }: { text: string }) {
  const lines = text.split('\n').filter((l) => l.trim());
  return (
    <ul className="space-y-2 text-sm leading-relaxed text-fg-muted">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        const bullet = trimmed.match(/^[-*•]\s+(.*)/);
        const numbered = trimmed.match(/^\d+\.\s+(.*)/);
        const content = bullet?.[1] ?? numbered?.[1] ?? trimmed;
        if (bullet || numbered) {
          return (
            <li key={i} className="ml-4 list-disc marker:text-fg-tertiary">
              {renderInline(content)}
            </li>
          );
        }
        return <p key={i}>{renderInline(trimmed)}</p>;
      })}
    </ul>
  );
}

function SectionSkeleton({ accent }: { accent: VividAccent }) {
  const c = VIVID[accent];
  return (
    <div className="animate-pulse rounded-2xl border border-bg-border p-5" style={{ borderLeftWidth: 4, borderLeftColor: c.from }}>
      <div className="h-4 w-48 rounded bg-bg-subtle" />
      <div className="mt-4 space-y-2">
        <div className="h-3 w-full rounded bg-bg-subtle" />
        <div className="h-3 w-5/6 rounded bg-bg-subtle" />
      </div>
    </div>
  );
}

export function InsightsPanel({ data }: Props) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SECTIONS.map((s) => [s.id, true])),
  );

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    setContent('');
    try {
      const res = await fetch('/api/kpis/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errJson = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errJson?.error ?? `Error ${res.status}`);
      }
      if (!res.body) throw new Error('Sin respuesta');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setContent(accumulated);
      }
      setUpdatedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [data]);

  useEffect(() => {
    void runAnalysis();
  }, [runAnalysis]);

  const sections = useMemo(() => parseSections(content), [content]);
  const hasAnySection = SECTIONS.some((s) => sections[s.id]?.trim());
  const formattedTime =
    updatedAt?.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) ?? '—';

  return (
    <KpiVividPage
      title="Análisis IA"
      subtitle="Insights generados por Claude sobre tus KPIs reales"
      sources={[{ id: 'claude', label: 'Claude', ok: !error }]}
    >
      {() => (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-bg-border bg-bg p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              <p className="text-sm text-fg-muted">
                Última actualización: <span className="font-semibold tabular-nums text-fg">{formattedTime}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => void runAnalysis()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-[#10B981] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              Regenerar
            </button>
          </div>

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
          ) : null}

          {loading && !content ? (
            <div className="space-y-4">
              <p className="text-sm font-medium text-fg-muted">Analizando tus KPIs…</p>
              {SECTIONS.map((s) => (
                <SectionSkeleton key={s.id} accent={s.accent} />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {SECTIONS.map((section) => {
                const body = sections[section.id] ?? '';
                const isOpen = openSections[section.id] ?? true;
                const isStreaming = loading && !body.trim();
                return (
                  <KpiVividPanel
                    key={section.id}
                    title={`${section.emoji} ${section.title}`}
                    accent={section.accent}
                    action={
                      <button type="button" onClick={() => setOpenSections((p) => ({ ...p, [section.id]: !p[section.id] }))} className="rounded-lg p-1 hover:bg-bg-subtle">
                        <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
                      </button>
                    }
                  >
                    {isOpen ? (
                      isStreaming ? (
                        <div className="animate-pulse space-y-2">
                          <div className="h-3 w-full rounded bg-bg-subtle" />
                          <div className="h-3 w-5/6 rounded bg-bg-subtle" />
                        </div>
                      ) : body.trim() ? (
                        <MarkdownBody text={body} />
                      ) : (
                        <p className="text-sm text-fg-muted">Esperando respuesta…</p>
                      )
                    ) : null}
                  </KpiVividPanel>
                );
              })}
              {loading && content && !hasAnySection ? (
                <p className="whitespace-pre-wrap text-sm text-fg-muted">{content}</p>
              ) : null}
            </div>
          )}
        </>
      )}
    </KpiVividPage>
  );
}
