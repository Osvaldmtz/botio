'use client';

import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Award,
  BarChart3,
  Bot,
  Clock,
  ExternalLink,
  FileText,
  Globe2,
  Link2,
  Minus,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { AdminShell } from '@/components/admin/admin-shell';
import { KpiEmptyState } from '@/components/admin/kpis/kpi-empty-state';
import { KpiSectionError } from '@/components/admin/kpis/kpi-section-error';
import type {
  SeoAiVisibility,
  SeoBacklinksDetail,
  SeoCountryOverview,
  SeoKpisResponse,
  SeoPageSpeedSummary,
  SeoPositionTracking,
  SeoPositionTrackingKeyword,
  SeoSiteAudit,
  SeoTopKeyword,
} from '@/lib/dataforseo-api';
import { clsStatus, lcpStatus, tbtStatus, type VitalsStatus } from '@/lib/pagespeed-utils';

/* ─── Design tokens ─── */
const PURPLE = '#7C3DE3';
const GREEN = '#22c55e';
const YELLOW = '#eab308';
const RED = '#ef4444';

const SEO_COUNTRIES = [
  { code: 2484, country: 'MX', label: 'México', flag: '🇲🇽' },
  { code: 2170, country: 'CO', label: 'Colombia', flag: '🇨🇴' },
  { code: 2032, country: 'AR', label: 'Argentina', flag: '🇦🇷' },
  { code: 2724, country: 'ES', label: 'España', flag: '🇪🇸' },
  { code: 2604, country: 'PE', label: 'Perú', flag: '🇵🇪' },
] as const;

const COUNTRIES = SEO_COUNTRIES.map((loc) => loc.country);

const GRADIENT_CARDS = {
  authority: 'from-[#3b82f6] to-[#1d4ed8]',
  etv: 'from-[#22c55e] to-[#15803d]',
  keywords: 'from-[#7C3DE3] to-[#5b21b6]',
  domains: 'from-[#f97316] to-[#c2410c]',
  backlinks: 'from-[#ec4899] to-[#be185d]',
} as const;

const AI_MODEL_COLORS: Record<string, string> = {
  ChatGPT: '#10a37f',
  'Google AI Overview': '#4285f4',
  'Modo IA': '#ea4335',
  Gemini: '#8b5cf6',
};

const RANK_BAR_COLORS = [GREEN, '#3b82f6', PURPLE, '#9ca3af'];

type Props = { initial: SeoKpisResponse | null; error: string | null };
type SortKey = 'keyword' | 'position' | 'volume' | 'visibility';
type PositionSortKey = 'keyword' | 'position' | 'volume' | 'visibility_pct' | 'etv' | 'url';
type SortDir = 'asc' | 'desc';

/* ─── Helpers (data logic unchanged) ─── */
function formatUpdatedAt(iso: string | null): string {
  if (!iso) return 'Sin datos recientes';
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}

function authorityScore(rank: number): number {
  if (rank <= 0) return 0;
  return Math.min(100, Math.round(rank / 10));
}

function aiVisibilityScore(totalMentions: number): number {
  if (totalMentions <= 0) return 0;
  return Math.min(100, Math.round(Math.log10(totalMentions + 1) * 25));
}

function keywordVisibility(keyword: SeoTopKeyword): number {
  if (keyword.position <= 0) return 0;
  return Math.min(100, Math.round((keyword.volume / Math.max(keyword.position, 1)) * 0.05));
}

function positionBadgeClass(position: number): string {
  if (position <= 10) return 'bg-emerald-500 text-white shadow-emerald-200/50 shadow-md';
  if (position <= 30) return 'bg-amber-400 text-white shadow-amber-200/50 shadow-md';
  return 'bg-rose-500 text-white shadow-rose-200/50 shadow-md';
}

function healthColor(score: number): string {
  if (score >= 90) return GREEN;
  if (score >= 70) return YELLOW;
  return RED;
}

function buildVisibilityChart(countryOverview: SeoCountryOverview | undefined, lastUpdated: string | null) {
  const end = lastUpdated ? new Date(lastUpdated) : new Date();
  const etv = countryOverview?.etv ?? 0;
  const keywords = countryOverview?.keywords_count ?? 0;
  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(end);
    date.setUTCDate(date.getUTCDate() - (29 - index));
    const isToday = index === 29;
    return {
      date: date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }),
      etv: isToday ? etv : null,
      keywords: isToday ? keywords : null,
    };
  });
}

function buildSparkline(value: number): { v: number }[] {
  const base = Math.max(value, 1);
  return Array.from({ length: 7 }, (_, i) => ({
    v: Math.max(0, Math.round(base * (0.55 + 0.07 * i + ((value * (i + 3)) % 11) / 30))),
  }));
}

function visibilityBarColor(pct: number): string {
  if (pct >= 60) return GREEN;
  if (pct >= 30) return PURPLE;
  return '#9ca3af';
}

/* ─── Shared UI primitives ─── */
function SectionHeader({ icon: Icon, title, subtitle }: { icon: typeof Search; title: string; subtitle?: string }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#7C3DE3]/10">
        <Icon className="h-4.5 w-4.5 text-[#7C3DE3]" strokeWidth={2} />
      </div>
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500">{title}</h3>
        {subtitle ? <p className="text-xs text-gray-400">{subtitle}</p> : null}
      </div>
    </div>
  );
}

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-gray-100 ${className}`} />;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonBlock className="h-28" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-32" />
        ))}
      </div>
      <SkeletonBlock className="h-64" />
      <SkeletonBlock className="h-96" />
    </div>
  );
}

function MiniSparkline({ data, color = '#ffffff' }: { data: { v: number }[]; color?: string }) {
  return (
    <div className="h-10 w-20 opacity-60">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <Area type="monotone" dataKey="v" stroke={color} fill={color} fillOpacity={0.25} strokeWidth={1.5} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function GradientMetricCard({
  label,
  value,
  gradient,
  icon: Icon,
  sparkValue,
  children,
}: {
  label: string;
  value: string;
  gradient: string;
  icon: typeof Search;
  sparkValue: number;
  children?: React.ReactNode;
}) {
  const spark = useMemo(() => buildSparkline(sparkValue), [sparkValue]);
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-5 text-white shadow-lg`}>
      <Icon className="absolute -right-2 -top-2 h-20 w-20 opacity-10" strokeWidth={1.2} />
      <div className="relative flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-white/70">{label}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{value}</p>
        </div>
        <MiniSparkline data={spark} />
      </div>
      {children ? <div className="relative mt-3 border-t border-white/20 pt-3">{children}</div> : null}
    </div>
  );
}

function SoftMetricCard({
  label,
  value,
  tint,
  icon: Icon,
}: {
  label: string;
  value: string;
  tint: string;
  icon: typeof Search;
}) {
  return (
    <div className={`rounded-2xl border border-gray-100 bg-gradient-to-br ${tint} p-5 shadow-sm`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 shadow-sm">
          <Icon className="h-5 w-5 text-[#7C3DE3]" strokeWidth={1.75} />
        </div>
      </div>
    </div>
  );
}

function InlineBar({ value, max, color = PURPLE }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="min-w-[2rem] text-right text-xs tabular-nums text-gray-500">{value.toLocaleString('es-MX')}</span>
    </div>
  );
}

function DarkTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | null; name?: string; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-gray-900 px-3 py-2 shadow-xl">
      <p className="mb-1 text-[10px] font-medium uppercase text-gray-400">{label}</p>
      {payload.map((entry) =>
        entry.value != null ? (
          <p key={entry.name} className="text-sm font-semibold tabular-nums text-white">
            {entry.name}: {entry.value.toLocaleString('es-MX')}
          </p>
        ) : null,
      )}
    </div>
  );
}

function DonutChart({
  data,
  size = 120,
  innerRadius = 38,
  outerRadius = 52,
}: {
  data: Array<{ name: string; value: number; color: string }>;
  size?: number;
  innerRadius?: number;
  outerRadius?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <div className="flex items-center justify-center text-xs text-gray-400" style={{ width: size, height: size }}>
        Sin datos
      </div>
    );
  }
  return (
    <ResponsiveContainer width={size} height={size}>
      <PieChart>
        <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={innerRadius} outerRadius={outerRadius} paddingAngle={2}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} stroke="none" />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const item = payload[0]?.payload as { name: string; value: number };
            return (
              <div className="rounded-lg bg-gray-900 px-2 py-1 text-xs text-white shadow-lg">
                {item.name}: {item.value.toLocaleString('es-MX')}
              </div>
            );
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function RadialGauge({ score, size = 160, label }: { score: number; size?: number; label?: string }) {
  const color = healthColor(score);
  const data = [{ name: 'score', value: score, fill: color }];
  return (
    <div className="relative mx-auto" style={{ width: size, height: size * 0.65 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart cx="50%" cy="100%" innerRadius="55%" outerRadius="100%" barSize={14} data={data} startAngle={180} endAngle={0}>
          <RadialBar background={{ fill: '#f3f4f6' }} dataKey="value" cornerRadius={8} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <p className="text-4xl font-bold tabular-nums" style={{ color }}>
          {score}
        </p>
        {label ? <p className="text-xs font-medium text-gray-400">{label}</p> : null}
      </div>
    </div>
  );
}

function MiniRadialGauge({ score, label }: { score: number; label: string }) {
  const color = healthColor(score);
  const data = [{ value: score, fill: color }];
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <div className="relative mx-auto mt-1 h-16 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart cx="50%" cy="100%" innerRadius="60%" outerRadius="100%" barSize={8} data={data} startAngle={180} endAngle={0}>
            <RadialBar background={{ fill: '#f3f4f6' }} dataKey="value" cornerRadius={4} />
          </RadialBarChart>
        </ResponsiveContainer>
        <p className="absolute inset-x-0 bottom-0 text-center text-lg font-bold tabular-nums" style={{ color }}>
          {score}
        </p>
      </div>
    </div>
  );
}

function VitalsGauge({ label, display, status }: { label: string; display: string; status: VitalsStatus }) {
  const color = status === 'good' ? GREEN : status === 'needs-improvement' ? YELLOW : RED;
  const pct = status === 'good' ? 85 : status === 'needs-improvement' ? 55 : 25;
  const data = [{ value: pct, fill: color }];
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${status === 'good' ? 'border-emerald-100 bg-emerald-50/50' : status === 'needs-improvement' ? 'border-amber-100 bg-amber-50/50' : 'border-rose-100 bg-rose-50/50'}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <div className="relative mx-auto mt-2 h-20 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart cx="50%" cy="100%" innerRadius="55%" outerRadius="100%" barSize={10} data={data} startAngle={180} endAngle={0}>
            <RadialBar background={{ fill: '#e5e7eb' }} dataKey="value" cornerRadius={6} />
          </RadialBarChart>
        </ResponsiveContainer>
        <p className="absolute inset-x-0 bottom-0 text-center text-2xl font-bold tabular-nums" style={{ color }}>
          {display}
        </p>
      </div>
    </div>
  );
}

/* ─── Position change indicator ─── */
function PositionChangeIndicator({ change }: { change: number | null }) {
  if (change === null || change === 0) {
    return (
      <span className="inline-flex items-center text-[10px] text-gray-400">
        <Minus className="h-3 w-3" />
      </span>
    );
  }
  const improved = change > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${improved ? 'text-emerald-600' : 'text-rose-600'}`}>
      {improved ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(change)}
    </span>
  );
}

/* ─── AI Visibility ─── */
function aiModelDisplayName(model: SeoAiVisibility['by_model'][number]['model']): string {
  if (model === 'Google AI Overview') return 'Vista IA';
  return model;
}

function AiModelIcon({ model }: { model: SeoAiVisibility['by_model'][number]['model'] }) {
  const color = AI_MODEL_COLORS[model] ?? PURPLE;
  const icons = { ChatGPT: Bot, 'Google AI Overview': Sparkles, 'Modo IA': Zap, Gemini: Globe2 };
  const Icon = icons[model] ?? Bot;
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-md" style={{ backgroundColor: color }}>
      <Icon className="h-5 w-5" />
    </div>
  );
}

function AiVisibilitySection({ visibility, synced }: { visibility: SeoAiVisibility | null | undefined; synced: boolean }) {
  if (!synced) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="animate-pulse space-y-4">
          <SkeletonBlock className="h-6 w-48" />
          <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
            <SkeletonBlock className="h-40" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonBlock key={i} className="h-32" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const data = visibility ?? {
    total_mentions: 0,
    pages_cited: 0,
    by_model: [
      { model: 'ChatGPT' as const, mentions: 0, pages_cited: 0 },
      { model: 'Google AI Overview' as const, mentions: 0, pages_cited: 0 },
      { model: 'Modo IA' as const, mentions: 0, pages_cited: 0 },
      { model: 'Gemini' as const, mentions: 0, pages_cited: 0 },
    ],
  };

  const score = aiVisibilityScore(data.total_mentions);
  const donutData = data.by_model
    .filter((m) => m.mentions > 0)
    .map((m) => ({ name: aiModelDisplayName(m.model), value: m.mentions, color: AI_MODEL_COLORS[m.model] }));

  return (
    <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50/80 via-white to-violet-50/30 p-6 shadow-sm">
      <SectionHeader icon={Sparkles} title="Búsqueda de IA" subtitle="ChatGPT · Google AI · Gemini · Modo IA · 🇺🇸 EN" />

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <div className="rounded-2xl border border-white bg-white/90 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Visibilidad en IA</p>
          <div className="mt-3 flex items-end gap-3">
            <p className="text-4xl font-bold tabular-nums text-[#1D4ED8]">{score}</p>
            <span
              className={`mb-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                score >= 60 ? 'bg-emerald-100 text-emerald-700' : score >= 30 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
              }`}
            >
              {score >= 60 ? 'Alta' : score >= 30 ? 'Media' : 'Baja'}
            </span>
          </div>
          <div className="mt-4 flex justify-center">
            <DonutChart
              data={donutData.length > 0 ? donutData : [{ name: 'Sin datos', value: 1, color: '#e5e7eb' }]}
              size={130}
            />
          </div>
          <div className="mt-3 space-y-2 border-t border-gray-100 pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Menciones</span>
              <span className="font-bold tabular-nums">{data.total_mentions.toLocaleString('es-MX')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Páginas citadas</span>
              <span className="font-bold tabular-nums">{data.pages_cited.toLocaleString('es-MX')}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {data.by_model.map((row) => (
            <div
              key={row.model}
              className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              style={{ borderTopWidth: 3, borderTopColor: AI_MODEL_COLORS[row.model] }}
            >
              <div className="flex items-center gap-3">
                <AiModelIcon model={row.model} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-gray-900">{aiModelDisplayName(row.model)}</p>
                  <p className="text-[10px] text-gray-400">{row.model}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg bg-gray-50 px-2 py-2.5">
                  <p className="text-lg font-bold tabular-nums" style={{ color: AI_MODEL_COLORS[row.model] }}>
                    {row.mentions.toLocaleString('es-MX')}
                  </p>
                  <p className="text-[10px] text-gray-400">Menciones</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-2 py-2.5">
                  <p className="text-lg font-bold tabular-nums text-gray-700">{row.pages_cited.toLocaleString('es-MX')}</p>
                  <p className="text-[10px] text-gray-400">Páginas</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Backlinks detail ─── */
function BacklinksDetailSection({
  detail,
  summaryReferringDomains,
  summaryTotal,
}: {
  detail: SeoBacklinksDetail | null | undefined;
  summaryReferringDomains: number;
  summaryTotal: number;
}) {
  const [showAllBacklinks, setShowAllBacklinks] = useState(false);

  if (!detail) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <SectionHeader icon={Link2} title="Perfil de backlinks" />
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-24" />
            ))}
          </div>
          <SkeletonBlock className="h-48" />
        </div>
      </div>
    );
  }

  const visibleBacklinks = showAllBacklinks ? detail.top_backlinks : detail.top_backlinks.slice(0, 5);
  const maxAnchorBl = Math.max(...detail.top_anchors.map((a) => a.backlinks), 1);

  const followDonut = [
    { name: 'Follow', value: detail.follow_count, color: GREEN },
    { name: 'Nofollow', value: detail.nofollow_count, color: '#9ca3af' },
  ];
  const remainder = Math.max(0, 100 - detail.text_pct - detail.image_pct);
  const typesPie = [
    { name: 'Texto', value: detail.text_pct, color: PURPLE },
    { name: 'Imagen', value: detail.image_pct, color: '#ec4899' },
    { name: 'Forma', value: Math.round(remainder * 0.6), color: '#3b82f6' },
    { name: 'Marco', value: Math.round(remainder * 0.4), color: '#9ca3af' },
  ].filter((d) => d.value > 0);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <SectionHeader icon={Link2} title="Perfil de backlinks" subtitle={`${summaryTotal.toLocaleString('es-MX')} backlinks · ${summaryReferringDomains.toLocaleString('es-MX')} dominios`} />

      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1fr_2fr]">
        <div className="flex flex-col items-center rounded-2xl border border-gray-100 bg-gray-50/50 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Follow vs Nofollow</p>
          <DonutChart data={followDonut} size={140} innerRadius={42} outerRadius={58} />
          <div className="mt-2 flex gap-4 text-xs">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[#22c55e]" /> Follow {detail.follow_count}
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-gray-400" /> Nofollow {detail.nofollow_count}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-center rounded-2xl border border-gray-100 bg-gray-50/50 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Tipos de enlace</p>
          <DonutChart data={typesPie.length > 0 ? typesPie : [{ name: 'Texto', value: 100, color: PURPLE }]} size={140} innerRadius={42} outerRadius={58} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Follow', value: detail.follow_count.toLocaleString('es-MX'), color: GREEN },
            { label: 'Nofollow', value: detail.nofollow_count.toLocaleString('es-MX'), color: '#9ca3af' },
            { label: 'Texto', value: `${detail.text_pct}%`, color: PURPLE },
            { label: 'Imagen', value: `${detail.image_pct}%`, color: '#ec4899' },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{item.label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums" style={{ color: item.color }}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <h4 className="mb-3 text-sm font-bold text-gray-700">Backlinks</h4>
          {detail.top_backlinks.length > 0 ? (
            <>
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/80 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      <th className="px-4 py-3">Página referente</th>
                      <th className="px-4 py-3">Anchor</th>
                      <th className="px-4 py-3">Tipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleBacklinks.map((row) => (
                      <tr
                        key={`${row.url_from}-${row.url_to}-${row.anchor}`}
                        className="border-b border-gray-50 transition-colors hover:bg-violet-50/40"
                      >
                        <td className="max-w-[260px] truncate px-4 py-3">
                          <a href={row.url_from} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-gray-800 hover:text-[#7C3DE3]" title={row.url_from}>
                            <span className="truncate">{row.url_from.replace(/^https?:\/\/(www\.)?/, '')}</span>
                            <ExternalLink className="h-3 w-3 shrink-0 text-gray-400" />
                          </a>
                        </td>
                        <td className="max-w-[180px] truncate px-4 py-3 text-xs text-gray-500">{row.anchor || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${row.dofollow ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                            {row.dofollow ? 'follow' : 'nofollow'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {detail.top_backlinks.length > 5 ? (
                <button type="button" onClick={() => setShowAllBacklinks((p) => !p)} className="mt-3 text-xs font-semibold text-[#7C3DE3] hover:underline">
                  {showAllBacklinks ? 'Ver menos' : 'Ver todos'}
                </button>
              ) : null}
            </>
          ) : (
            <KpiEmptyState description="Sin backlinks detallados en caché" />
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h4 className="mb-3 text-sm font-bold text-gray-700">Mejores anclajes</h4>
            {detail.top_anchors.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/80 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      <th className="px-4 py-3">Anchor</th>
                      <th className="px-4 py-3">Dominios</th>
                      <th className="px-4 py-3">Backlinks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.top_anchors.map((row) => (
                      <tr key={`${row.anchor}-${row.backlinks}`} className="border-b border-gray-50 hover:bg-violet-50/30">
                        <td className="max-w-[160px] truncate px-4 py-3 font-medium text-gray-800">{row.anchor || '—'}</td>
                        <td className="px-4 py-3 tabular-nums text-gray-600">{row.referring_domains.toLocaleString('es-MX')}</td>
                        <td className="px-4 py-3">
                          <InlineBar value={row.backlinks} max={maxAnchorBl} color={PURPLE} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <KpiEmptyState description="Sin datos de anclajes" />
            )}
          </div>

          <div>
            <h4 className="mb-3 text-sm font-bold text-gray-700">Dominios de referencia</h4>
            {detail.top_referring_domains.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/80 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Dominio</th>
                      <th className="px-4 py-3">Rank</th>
                      <th className="px-4 py-3">Backlinks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.top_referring_domains.map((row, idx) => (
                      <tr key={row.domain} className="border-b border-gray-50 hover:bg-violet-50/30">
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                            style={{ backgroundColor: idx === 0 ? '#eab308' : idx < 3 ? PURPLE : '#9ca3af' }}
                          >
                            {idx + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {row.domain}
                          {idx === 0 ? (
                            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Top</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-gray-600">{row.rank}</td>
                        <td className="px-4 py-3 tabular-nums font-semibold text-gray-800">{row.backlinks.toLocaleString('es-MX')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <KpiEmptyState description="Sin dominios de referencia" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Position tracking ─── */
function PositionTrackingSection({ tracking }: { tracking: SeoPositionTracking }) {
  const [sortKey, setSortKey] = useState<PositionSortKey>('visibility_pct');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showAllKeywords, setShowAllKeywords] = useState(false);

  const sortedKeywords = useMemo(() => {
    const rows = [...tracking.top_keywords];
    rows.sort((a, b) => {
      const factor = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'keyword' || sortKey === 'url') return a[sortKey].localeCompare(b[sortKey]) * factor;
      return (a[sortKey] - b[sortKey]) * factor;
    });
    return rows;
  }, [sortDir, sortKey, tracking.top_keywords]);

  const visibleKeywords = showAllKeywords ? sortedKeywords : sortedKeywords.slice(0, 10);
  const maxEtv = Math.max(...tracking.top_keywords.map((k) => k.etv), 0.01);
  const maxPageTraffic = Math.max(...tracking.pages.map((p) => p.estimated_traffic), 0.01);

  const distribution = [
    { label: 'Top 3', value: tracking.keywords_top3 },
    { label: 'Top 10', value: tracking.keywords_top10 },
    { label: 'Top 20', value: tracking.keywords_top20 },
    { label: 'Top 100', value: tracking.keywords_top100 },
  ];

  const barData = distribution.map((d, i) => ({ name: d.label, value: d.value, fill: RANK_BAR_COLORS[i] }));

  function toggleSort(key: PositionSortKey) {
    if (sortKey === key) setSortDir((p) => (p === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'keyword' || key === 'url' || key === 'position' ? 'asc' : 'desc');
    }
  }

  function sortIndicator(key: PositionSortKey): string {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeader icon={Target} title="Rastreo de posición" subtitle="🇲🇽 México · ranked_keywords_2484" />
        <div className="flex gap-2 text-xs">
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700 ring-1 ring-emerald-100">
            ↑ Mejoradas: <strong>{tracking.keywords_improved ?? 'N/D'}</strong>
          </span>
          <span className="rounded-full bg-rose-50 px-3 py-1.5 font-medium text-rose-700 ring-1 ring-rose-100">
            ↓ En declive: <strong>{tracking.keywords_declined ?? 'N/D'}</strong>
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SoftMetricCard label="Visibilidad" value={`${tracking.visibility}%`} tint="from-violet-50/80 to-white" icon={Target} />
        <SoftMetricCard
          label="Tráfico estimado"
          value={tracking.estimated_traffic.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          tint="from-emerald-50/80 to-white"
          icon={TrendingUp}
        />
        <SoftMetricCard label="Posición media" value={tracking.avg_position.toFixed(1)} tint="from-blue-50/80 to-white" icon={BarChart3} />
        <SoftMetricCard label="Keywords rastreadas" value={tracking.keywords_tracked.toLocaleString('es-MX')} tint="from-orange-50/80 to-white" icon={Search} />
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h4 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500">Distribución de rankings</h4>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={32} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="rounded-lg bg-gray-900 px-3 py-2 text-sm text-white shadow-xl">
                      {label}: <strong>{Number(payload[0]?.value).toLocaleString('es-MX')}</strong>
                    </div>
                  );
                }}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={64}>
                {barData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h4 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500">Keywords principales</h4>
        {tracking.top_keywords.length > 0 ? (
          <>
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    {(
                      [
                        ['keyword', 'Keyword'],
                        ['position', 'Posición'],
                        ['volume', 'Vol.'],
                        ['visibility_pct', 'Visibilidad'],
                        ['etv', 'ETV'],
                        ['url', 'URL'],
                      ] as const
                    ).map(([key, label]) => (
                      <th key={key} className="px-4 py-3">
                        <button type="button" onClick={() => toggleSort(key)} className="hover:text-gray-700">
                          {label}
                          {sortIndicator(key)}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleKeywords.map((row: SeoPositionTrackingKeyword, idx) => (
                    <tr
                      key={`${row.keyword}-${row.url}`}
                      className="border-b border-gray-50 transition-colors hover:bg-violet-50/50"
                      style={{ animation: `fadeIn 0.35s ease-out ${idx * 40}ms both` }}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">{row.keyword}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold tabular-nums ${positionBadgeClass(row.position)}`}>
                            {row.position}
                          </span>
                          <PositionChangeIndicator change={row.position_change} />
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-gray-700">{row.volume.toLocaleString('es-MX')}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-20 overflow-hidden rounded-full bg-gray-100">
                            <div className="h-full rounded-full transition-all" style={{ width: `${row.visibility_pct}%`, backgroundColor: visibilityBarColor(row.visibility_pct) }} />
                          </div>
                          <span className="text-xs tabular-nums text-gray-500">{row.visibility_pct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <InlineBar value={Math.round(row.etv * 100) / 100} max={maxEtv} color="#22c55e" />
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-3 text-xs text-gray-500">
                        {row.url ? (
                          <a href={row.url} target="_blank" rel="noopener noreferrer" className="hover:text-[#7C3DE3] hover:underline" title={row.url}>
                            {row.url.replace(/^https?:\/\/(www\.)?/, '')}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sortedKeywords.length > 10 ? (
              <button type="button" onClick={() => setShowAllKeywords((p) => !p)} className="mt-3 text-xs font-semibold text-[#7C3DE3] hover:underline">
                {showAllKeywords ? 'Ver menos' : `Ver todas (${sortedKeywords.length})`}
              </button>
            ) : null}
          </>
        ) : (
          <KpiEmptyState description="Sin keywords rankeadas en México" />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <SectionHeader icon={FileText} title="Páginas" />
          {tracking.pages.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    <th className="px-4 py-3">URL</th>
                    <th className="px-4 py-3">Kw</th>
                    <th className="px-4 py-3">Pos. media</th>
                    <th className="px-4 py-3">Tráfico est.</th>
                  </tr>
                </thead>
                <tbody>
                  {tracking.pages.map((page) => (
                    <tr key={page.url} className="border-b border-gray-50 hover:bg-violet-50/30">
                      <td className="max-w-[180px] truncate px-4 py-3 text-xs font-medium text-gray-800">
                        {page.url.startsWith('http') ? (
                          <a href={page.url} target="_blank" rel="noopener noreferrer" className="hover:text-[#7C3DE3]" title={page.url}>
                            {page.url.replace(/^https?:\/\/(www\.)?kalyo\.io/, '') || '/'}
                          </a>
                        ) : (
                          page.url
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{page.keywords_count}</td>
                      <td className="px-4 py-3 tabular-nums">{page.avg_position.toFixed(1)}</td>
                      <td className="px-4 py-3">
                        <InlineBar value={page.estimated_traffic} max={maxPageTraffic} color={PURPLE} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <KpiEmptyState description="Sin páginas con keywords rankeadas" />
          )}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <SectionHeader icon={Users} title="Competidores" />
          {tracking.competitors_visibility.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Dominio</th>
                    <th className="px-4 py-3">Kw comunes</th>
                    <th className="px-4 py-3">Visibilidad</th>
                  </tr>
                </thead>
                <tbody>
                  {tracking.competitors_visibility.map((row, index) => (
                    <tr key={row.domain} className="border-b border-gray-50 hover:bg-violet-50/30">
                      <td className="px-4 py-3">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: index === 0 ? '#eab308' : index < 3 ? PURPLE : '#9ca3af' }}>
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {row.domain}
                        {index === 0 ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Top</span> : null}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{row.common_keywords.toLocaleString('es-MX')}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                            <div className="h-full rounded-full" style={{ width: `${row.visibility_approx}%`, backgroundColor: visibilityBarColor(row.visibility_approx) }} />
                          </div>
                          <span className="text-xs tabular-nums text-gray-500">{row.visibility_approx}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <KpiEmptyState description="Sin datos de competidores en caché" />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Site audit ─── */
function SiteAuditSections({ audit, pagespeed }: { audit: SeoSiteAudit | null | undefined; pagespeed: SeoPageSpeedSummary | null | undefined }) {
  if (!audit) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <SectionHeader icon={Shield} title="Site audit" />
        <div className="animate-pulse space-y-4">
          <SkeletonBlock className="h-48" />
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-24" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (audit.status === 'pending') {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <SectionHeader icon={Shield} title="Site audit" subtitle="Crawl en cola" />
        <div className="animate-pulse space-y-4 py-4">
          <SkeletonBlock className="mx-auto h-36 w-56 rounded-full" />
          <p className="text-center text-sm font-medium text-gray-700">Análisis en proceso, disponible mañana</p>
          <p className="text-center text-xs text-gray-400">El crawl On-Page de kalyo.io fue encolado.</p>
        </div>
      </div>
    );
  }

  const warnings = [
    { label: 'JS/CSS sin minificar', count: audit.js_css_not_minified },
    { label: 'Enlaces externos rotos', count: audit.broken_links },
    { label: 'Bajo número de palabras', count: audit.low_word_count },
    { label: 'Páginas con 1 solo enlace interno', count: audit.single_internal_link_pages },
    { label: 'Contenido sin optimizar', count: audit.unoptimized_content },
  ].filter((item) => item.count > 0);

  const lcpS = pagespeed ? lcpStatus(pagespeed.lcp) : 'needs-improvement';
  const clsS = pagespeed ? clsStatus(pagespeed.cls) : 'needs-improvement';
  const tbtS = pagespeed ? tbtStatus(pagespeed.tbt) : 'needs-improvement';

  const thematic = [
    { label: 'Rastreabilidad', score: audit.crawlability_score },
    { label: 'HTTPS', score: audit.https_score },
    { label: 'SEO Internacional', score: audit.international_seo_score },
    { label: 'Rendimiento', score: pagespeed?.performance_mobile ?? audit.performance_score },
    { label: 'Enlaces internos', score: audit.internal_links_score },
    { label: 'Marcado', score: audit.markup_score },
  ];

  return (
    <div className="space-y-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <SectionHeader icon={Shield} title="Site audit" subtitle={audit.status === 'in_progress' ? `Crawl en progreso · ${audit.pages_crawled} páginas` : 'Análisis completo'} />

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <div className="rounded-2xl border border-gray-100 bg-gradient-to-br from-gray-50 to-white p-5 shadow-sm">
          <h4 className="mb-2 text-sm font-bold text-gray-700">Site Health</h4>
          <RadialGauge score={audit.site_health} label="Site Health" />
          <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs">
            {[
              { label: 'Correctas', value: audit.pages_ok, bg: 'bg-emerald-50 text-emerald-800' },
              { label: 'Problemas', value: audit.pages_with_issues, bg: 'bg-amber-50 text-amber-800' },
              { label: 'Redirigidas', value: audit.pages_redirected, bg: 'bg-sky-50 text-sky-800' },
              { label: 'Bloqueadas', value: audit.pages_blocked, bg: 'bg-rose-50 text-rose-800' },
            ].map((item) => (
              <div key={item.label} className={`rounded-lg px-2 py-2 ${item.bg}`}>
                <p className="text-lg font-bold tabular-nums">{item.value}</p>
                <p>{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500">Puntuación temática</h4>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {thematic.map((item) => (
              <MiniRadialGauge key={item.label} label={item.label} score={item.score} />
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h4 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-700">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Advertencias principales
          </h4>
          {warnings.length > 0 ? (
            <ul className="space-y-2">
              {warnings.map((item) => (
                <li key={item.label} className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-sm">
                  <span className="text-gray-700">⚠️ {item.label}</span>
                  <span className="rounded-full bg-rose-500 px-2.5 py-0.5 text-xs font-bold text-white">{item.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">Sin advertencias críticas detectadas.</p>
          )}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h4 className="mb-4 text-sm font-bold text-gray-700">Core Web Vitals · mobile</h4>
          {pagespeed ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <VitalsGauge label="LCP" display={`${pagespeed.lcp.toFixed(1)}s`} status={lcpS} />
              <VitalsGauge label="CLS" display={pagespeed.cls.toFixed(3)} status={clsS} />
              <VitalsGauge label="TBT" display={`${pagespeed.tbt}ms`} status={tbtS} />
            </div>
          ) : (
            <div className="animate-pulse space-y-2">
              <SkeletonBlock className="h-24" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main dashboard ─── */
export function SeoDashboard({ initial, error: initialError }: Props) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState(initialError);
  const [refreshing, setRefreshing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [country, setCountry] = useState<string>('MX');
  const [sortKey, setSortKey] = useState<SortKey>('position');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [chartMetric, setChartMetric] = useState<'etv' | 'keywords'>('etv');

  const countryOverview = useMemo(() => data?.overview.find((row) => row.country === country), [country, data?.overview]);
  const chartData = useMemo(() => buildVisibilityChart(countryOverview, data?.last_updated ?? null), [countryOverview, data?.last_updated]);

  const sortedKeywords = useMemo(() => {
    const rows = (data?.top_keywords ?? []).filter((row) => row.country === country);
    const enriched = rows.map((row) => ({ ...row, visibility: keywordVisibility(row) }));
    enriched.sort((a, b) => {
      const factor = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'keyword') return a.keyword.localeCompare(b.keyword) * factor;
      return (a[sortKey] - b[sortKey]) * factor;
    });
    return enriched;
  }, [country, data?.top_keywords, sortDir, sortKey]);

  const chartPeakIndex = useMemo(() => {
    let max = -1;
    let idx = 0;
    chartData.forEach((row, i) => {
      const v = row[chartMetric];
      if (v != null && v > max) {
        max = v;
        idx = i;
      }
    });
    return idx;
  }, [chartData, chartMetric]);

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const syncRes = await fetch('/api/admin/seo/refresh', { method: 'POST' });
      const syncJson = (await syncRes.json()) as { error?: string; updated?: string[]; errors?: Array<{ key: string; error: string }> };
      if (!syncRes.ok) throw new Error(syncJson.error ?? 'Error al sincronizar SEO');
      const res = await fetch('/api/kpis/seo');
      const json = (await res.json()) as SeoKpisResponse & { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar SEO');
      setData(json);
      const updatedCount = syncJson.updated?.length ?? 0;
      const errorCount = syncJson.errors?.length ?? 0;
      setSuccessMessage(errorCount > 0 ? `Sync parcial: ${updatedCount} claves actualizadas, ${errorCount} con error.` : `SEO actualizado correctamente (${updatedCount} claves).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshing(false);
    }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((p) => (p === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'keyword' ? 'asc' : key === 'position' ? 'asc' : 'desc');
    }
  }

  function sortIndicator(key: SortKey): string {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  }

  const authority = authorityScore(data?.backlinks?.rank ?? 0);
  const hasData = Boolean(data && data.overview.length > 0);

  return (
    <AdminShell title="SEO Intelligence" subtitle="Monitoreo orgánico · DataForSEO">
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-2xl border border-gray-100 bg-gradient-to-br from-[#7C3DE3]/5 via-white to-violet-50/30 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7C3DE3] to-[#5b21b6] text-white shadow-lg shadow-violet-200">
                  <Globe2 className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold tracking-tight text-gray-900">kalyo.io</h2>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                      </span>
                      En vivo
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">Dominio principal · Latinoamérica + España</p>
                </div>
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-400">
                <Clock className="h-3.5 w-3.5" />
                Última actualización: <span className="font-medium text-gray-600">{formatUpdatedAt(data?.last_updated ?? null)}</span>
              </p>
            </div>

            <div className="flex flex-col items-end gap-3">
              <div className="flex border-b border-gray-200">
                {COUNTRIES.map((code) => {
                  const meta = SEO_COUNTRIES.find((loc) => loc.country === code);
                  const active = country === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setCountry(code)}
                      className={`relative px-4 py-2.5 text-sm font-semibold transition ${
                        active ? 'text-[#7C3DE3]' : 'text-gray-400 hover:text-gray-700'
                      }`}
                      title={meta?.label}
                    >
                      <span className="mr-1">{meta?.flag}</span>
                      {code}
                      {active ? <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[#7C3DE3]" /> : null}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#7C3DE3] to-[#5b21b6] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-200 transition hover:opacity-90 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Actualizando…' : 'Refrescar'}
              </button>
            </div>
          </div>
        </div>

        {successMessage ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{successMessage}</div>
        ) : null}
        {error ? <KpiSectionError title="SEO kalyo.io" error={error} /> : null}
        {!data?.configured ? (
          <KpiSectionError title="DataForSEO" error="Configura DATAFORSEO_LOGIN y DATAFORSEO_PASSWORD en Vercel (proyecto botio)." />
        ) : null}

        {refreshing && !hasData ? <DashboardSkeleton /> : null}

        {!hasData && !error && !refreshing ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="animate-pulse space-y-4">
              <SkeletonBlock className="h-8 w-64" />
              <SkeletonBlock className="h-32" />
              <p className="text-center text-sm text-gray-400">El cron diario poblará la caché SEO. También puedes pulsar Refrescar.</p>
            </div>
          </div>
        ) : null}

        {hasData && countryOverview ? (
          <>
            <AiVisibilitySection visibility={data?.ai_visibility} synced={data?.ai_visibility != null} />

            {/* Top metric cards */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <GradientMetricCard label="Authority Score" value={String(authority)} gradient={GRADIENT_CARDS.authority} icon={Award} sparkValue={authority}>
                <p className="text-xs text-white/70">
                  Domain rank: <span className="font-bold text-white">{data?.backlinks?.rank ?? '—'}</span>
                </p>
              </GradientMetricCard>
              <GradientMetricCard label="Tráfico orgánico (ETV)" value={countryOverview.etv.toLocaleString('es-MX')} gradient={GRADIENT_CARDS.etv} icon={TrendingUp} sparkValue={countryOverview.etv} />
              <GradientMetricCard label="Keywords orgánicas" value={countryOverview.keywords_count.toLocaleString('es-MX')} gradient={GRADIENT_CARDS.keywords} icon={Search} sparkValue={countryOverview.keywords_count} />
              <GradientMetricCard label="Dominios de referencia" value={(data?.backlinks?.referring_domains ?? 0).toLocaleString('es-MX')} gradient={GRADIENT_CARDS.domains} icon={Link2} sparkValue={data?.backlinks?.referring_domains ?? 0} />
              <GradientMetricCard label="Backlinks totales" value={(data?.backlinks?.total ?? 0).toLocaleString('es-MX')} gradient={GRADIENT_CARDS.backlinks} icon={Globe2} sparkValue={data?.backlinks?.total ?? 0} />
            </div>

            {data?.position_tracking ? (
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <PositionTrackingSection tracking={data.position_tracking} />
              </div>
            ) : null}

            <SiteAuditSections audit={data?.site_audit} pagespeed={data?.pagespeed} />

            {/* Visibility over time */}
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <SectionHeader icon={TrendingUp} title="Visibilidad en el tiempo" subtitle={`${countryOverview.flag} ${countryOverview.label} · últimos 30 días`} />
                <div className="inline-flex rounded-full bg-gray-100 p-1">
                  {(['etv', 'keywords'] as const).map((metric) => (
                    <button
                      key={metric}
                      type="button"
                      onClick={() => setChartMetric(metric)}
                      className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                        chartMetric === metric ? 'bg-white text-[#7C3DE3] shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {metric === 'etv' ? 'ETV' : 'Keywords'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="seoAreaFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={PURPLE} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={PURPLE} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={44} />
                    <Tooltip content={<DarkTooltip />} />
                    <Area
                      type="monotone"
                      dataKey={chartMetric}
                      name={chartMetric === 'etv' ? 'ETV' : 'Keywords'}
                      stroke={PURPLE}
                      strokeWidth={2.5}
                      fill="url(#seoAreaFill)"
                      connectNulls={false}
                      dot={(props) => {
                        const { cx, cy, index } = props as { cx: number; cy: number; index: number };
                        if (index !== chartPeakIndex) return null;
                        return <circle key={index} cx={cx} cy={cy} r={6} fill={PURPLE} stroke="#fff" strokeWidth={2} />;
                      }}
                      activeDot={{ r: 6, fill: PURPLE, stroke: '#fff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-3 text-xs text-gray-400">El histórico completo se acumulará con cada sync diario del cron.</p>
            </div>

            {/* Country keywords table */}
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <SectionHeader icon={Search} title={`Keywords principales · ${countryOverview.flag} ${country}`} />
              {sortedKeywords.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/80 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                        {(
                          [
                            ['keyword', 'Keyword'],
                            ['position', 'Posición'],
                            ['volume', 'Volumen'],
                            ['visibility', 'Visibilidad'],
                          ] as const
                        ).map(([key, label]) => (
                          <th key={key} className="px-4 py-3">
                            <button type="button" onClick={() => toggleSort(key)} className="hover:text-gray-700">
                              {label}
                              {sortIndicator(key)}
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedKeywords.map((row) => (
                        <tr key={`${row.country}-${row.keyword}-${row.position}`} className="border-b border-gray-50 transition-colors hover:bg-violet-50/50">
                          <td className="px-4 py-3 font-medium text-gray-900">{row.keyword}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold tabular-nums ${positionBadgeClass(row.position)}`}>
                              {row.position}
                            </span>
                          </td>
                          <td className="px-4 py-3 tabular-nums text-gray-700">{row.volume.toLocaleString('es-MX')}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-2.5 w-20 overflow-hidden rounded-full bg-gray-100">
                                <div className="h-full rounded-full" style={{ width: `${row.visibility}%`, backgroundColor: visibilityBarColor(row.visibility) }} />
                              </div>
                              <span className="text-xs tabular-nums text-gray-500">{row.visibility}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <KpiEmptyState description={`Sin keywords rankeadas para ${country}`} />
              )}
            </div>

            {/* Competitors + Backlinks */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <SectionHeader icon={Users} title="Competidores · México" />
                {data?.competitors.length ? (
                  <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/80 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                          <th className="px-4 py-3">#</th>
                          <th className="px-4 py-3">Dominio</th>
                          <th className="px-4 py-3">Keywords comunes</th>
                          <th className="px-4 py-3">ETV estimado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.competitors.map((row, index) => (
                          <tr key={row.domain} className="border-b border-gray-50 hover:bg-violet-50/30">
                            <td className="px-4 py-3">
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: index === 0 ? '#eab308' : index < 3 ? PURPLE : '#9ca3af' }}>
                                {index + 1}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-800">
                              {row.domain}
                              {index === 0 ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Top</span> : null}
                            </td>
                            <td className="px-4 py-3 tabular-nums">{row.common_keywords.toLocaleString('es-MX')}</td>
                            <td className="px-4 py-3 tabular-nums font-semibold">{row.etv.toLocaleString('es-MX')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <KpiEmptyState description="Sin datos de competidores en caché" />
                )}
              </div>

              <BacklinksDetailSection detail={data?.backlinks_detail} summaryReferringDomains={data?.backlinks?.referring_domains ?? 0} summaryTotal={data?.backlinks?.total ?? 0} />
            </div>
          </>
        ) : null}
      </div>
    </AdminShell>
  );
}
