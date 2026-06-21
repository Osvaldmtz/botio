'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { KpiLayout } from '@/components/admin/kpis/kpi-layout';
import type { KpiInsightsData } from '@/lib/kpi/insights-types';

type Props = {
  data: KpiInsightsData;
};

type InsightSection = {
  id: string;
  emoji: string;
  title: string;
  color: string;
  match: string;
};

const SECTIONS: InsightSection[] = [
  {
    id: 'working',
    emoji: '✅',
    title: 'Lo que está funcionando',
    color: '#10B981',
    match: 'Lo que está funcionando',
  },
  {
    id: 'alerts',
    emoji: '⚠️',
    title: 'Alertas y problemas detectados',
    color: '#F59E0B',
    match: 'Alertas y problemas detectados',
  },
  {
    id: 'actions',
    emoji: '🎯',
    title: 'Top 3 acciones esta semana',
    color: '#7F77DD',
    match: 'Top 3 acciones esta semana',
  },
  {
    id: 'projection',
    emoji: '📈',
    title: 'Proyección a 30 días',
    color: '#3B82F6',
    match: 'Proyección a 30 días',
  },
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
      if (header.includes(section.match)) {
        result[section.id] = body;
      }
    }
  }

  return result;
}

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-fg">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function MarkdownBody({ text }: { text: string }) {
  const lines = text.split('\n').filter((line) => line.trim());

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

        return (
          <p key={i} className="text-fg-muted">
            {renderInline(trimmed)}
          </p>
        );
      })}
    </ul>
  );
}

function SectionSkeleton({ color }: { color: string }) {
  return (
    <div
      className="animate-pulse rounded-lg border border-bg-border bg-bg p-5"
      style={{ borderLeftWidth: 4, borderLeftColor: color }}
    >
      <div className="h-4 w-48 rounded bg-bg-subtle" />
      <div className="mt-4 space-y-2">
        <div className="h-3 w-full rounded bg-bg-subtle" />
        <div className="h-3 w-5/6 rounded bg-bg-subtle" />
        <div className="h-3 w-4/6 rounded bg-bg-subtle" />
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

      if (!res.body) throw new Error('Sin respuesta del servidor');

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

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const formattedTime =
    updatedAt?.toLocaleString('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }) ?? '—';

  return (
    <KpiLayout
      title="Análisis IA"
      subtitle="Generado por Claude · Basado en datos reales"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-fg-muted">
          Última actualización:{' '}
          <span className="tabular-nums text-fg">{formattedTime}</span>
        </p>
        <button
          type="button"
          onClick={() => void runAnalysis()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-[#10B981] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} strokeWidth={1.5} />
          Regenerar análisis
        </button>
      </div>

      {error ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {loading && !content ? (
        <div className="space-y-4">
          <p className="text-sm font-medium text-fg-muted">Analizando tus KPIs...</p>
          {SECTIONS.map((section) => (
            <SectionSkeleton key={section.id} color={section.color} />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {SECTIONS.map((section) => {
            const body = sections[section.id] ?? '';
            const isOpen = openSections[section.id] ?? true;
            const isStreamingSection = loading && !body.trim();

            return (
              <div
                key={section.id}
                className="overflow-hidden rounded-lg border border-bg-border bg-bg"
                style={{ borderLeftWidth: 4, borderLeftColor: section.color }}
              >
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                >
                  <span className="text-sm font-semibold text-fg">
                    {section.emoji} {section.title}
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-fg-tertiary transition-transform',
                      isOpen && 'rotate-180',
                    )}
                    strokeWidth={1.5}
                  />
                </button>

                {isOpen ? (
                  <div className="border-t border-bg-border px-5 pb-5 pt-4">
                    {isStreamingSection ? (
                      <div className="animate-pulse space-y-2">
                        <div className="h-3 w-full rounded bg-bg-subtle" />
                        <div className="h-3 w-5/6 rounded bg-bg-subtle" />
                        <div className="h-3 w-4/6 rounded bg-bg-subtle" />
                      </div>
                    ) : body.trim() ? (
                      <MarkdownBody text={body} />
                    ) : (
                      <p className="text-sm text-fg-tertiary">Esperando respuesta...</p>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}

          {loading && content && !hasAnySection ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg-muted">{content}</p>
          ) : null}
        </div>
      )}
    </KpiLayout>
  );
}
