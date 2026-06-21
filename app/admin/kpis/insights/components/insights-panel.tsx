'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, RefreshCw, Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { KpiInsightsData } from '@/lib/kpi/insights-types';
import { KpiJarvisPage } from '@/components/admin/kpis/jarvis/kpi-page-shell';
import { KpiJarvisPanel } from '@/components/admin/kpis/jarvis/kpi-jarvis-theme';

type Props = {
  data: KpiInsightsData;
};

type InsightSection = {
  id: string;
  emoji: string;
  title: string;
  accent: 'emerald' | 'amber' | 'violet' | 'cyan';
  match: string;
};

const SECTIONS: InsightSection[] = [
  {
    id: 'working',
    emoji: '✅',
    title: 'Lo que está funcionando',
    accent: 'emerald',
    match: 'Lo que está funcionando',
  },
  {
    id: 'alerts',
    emoji: '⚠️',
    title: 'Alertas y problemas detectados',
    accent: 'amber',
    match: 'Alertas y problemas detectados',
  },
  {
    id: 'actions',
    emoji: '🎯',
    title: 'Top 3 acciones esta semana',
    accent: 'violet',
    match: 'Top 3 acciones esta semana',
  },
  {
    id: 'projection',
    emoji: '📈',
    title: 'Proyección a 30 días',
    accent: 'cyan',
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
        <strong key={i} className="font-semibold text-slate-100">
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
    <ul className="space-y-2 text-sm leading-relaxed text-slate-300">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        const bullet = trimmed.match(/^[-*•]\s+(.*)/);
        const numbered = trimmed.match(/^\d+\.\s+(.*)/);
        const content = bullet?.[1] ?? numbered?.[1] ?? trimmed;

        if (bullet || numbered) {
          return (
            <li key={i} className="ml-4 list-disc marker:text-cyan-500/60">
              {renderInline(content)}
            </li>
          );
        }

        return (
          <p key={i} className="text-slate-300">
            {renderInline(trimmed)}
          </p>
        );
      })}
    </ul>
  );
}

function SectionSkeleton({ accent }: { accent: InsightSection['accent'] }) {
  return (
    <KpiJarvisPanel title="Analizando…" accent={accent}>
      <div className="animate-pulse space-y-2">
        <div className="h-3 w-full rounded bg-slate-800" />
        <div className="h-3 w-5/6 rounded bg-slate-800" />
        <div className="h-3 w-4/6 rounded bg-slate-800" />
      </div>
    </KpiJarvisPanel>
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
    <KpiJarvisPage
      title="Análisis IA"
      subtitle="Jarvis Intelligence — Claude sobre datos reales"
      sources={[{ id: 'claude', label: 'Claude', ok: !error }]}
    >
      {() => (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-400" />
              <p className="text-sm text-slate-300">
                Última actualización:{' '}
                <span className="font-mono tabular-nums text-violet-200">{formattedTime}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => void runAnalysis()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-50"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} strokeWidth={1.5} />
              Regenerar análisis
            </button>
          </div>

          {error ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          ) : null}

          {loading && !content ? (
            <div className="space-y-4">
              <p className="text-sm font-medium text-cyan-300/80">Analizando tus KPIs…</p>
              {SECTIONS.map((section) => (
                <SectionSkeleton key={section.id} accent={section.accent} />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {SECTIONS.map((section) => {
                const body = sections[section.id] ?? '';
                const isOpen = openSections[section.id] ?? true;
                const isStreamingSection = loading && !body.trim();

                return (
                  <KpiJarvisPanel
                    key={section.id}
                    title={`${section.emoji} ${section.title}`}
                    accent={section.accent}
                    action={
                      <button
                        type="button"
                        onClick={() => toggleSection(section.id)}
                        className="rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-slate-200"
                      >
                        <ChevronDown
                          className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')}
                          strokeWidth={1.5}
                        />
                      </button>
                    }
                  >
                    {isOpen ? (
                      isStreamingSection ? (
                        <div className="animate-pulse space-y-2">
                          <div className="h-3 w-full rounded bg-slate-800" />
                          <div className="h-3 w-5/6 rounded bg-slate-800" />
                          <div className="h-3 w-4/6 rounded bg-slate-800" />
                        </div>
                      ) : body.trim() ? (
                        <MarkdownBody text={body} />
                      ) : (
                        <p className="text-sm text-slate-500">Esperando respuesta…</p>
                      )
                    ) : null}
                  </KpiJarvisPanel>
                );
              })}

              {loading && content && !hasAnySection ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-400">{content}</p>
              ) : null}
            </div>
          )}
        </>
      )}
    </KpiJarvisPage>
  );
}
