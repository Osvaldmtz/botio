'use client';

import { cn } from '@/lib/cn';

export function KpiJarvisCanvas({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-cyan-500/20',
        'bg-[linear-gradient(145deg,#0a0f1a_0%,#0d1528_45%,#0a1628_100%)]',
        'shadow-[0_0_60px_-12px_rgba(16,185,129,0.35)]',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(16,185,129,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.8) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      <div className="pointer-events-none absolute -left-24 top-0 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-0 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl" />
      <div className="relative z-[1] space-y-5 p-5 sm:p-6">{children}</div>
    </div>
  );
}

export function KpiJarvisPanel({
  title,
  subtitle,
  accent = 'emerald',
  children,
  className,
  action,
}: {
  title: string;
  subtitle?: string;
  accent?: 'emerald' | 'violet' | 'cyan' | 'amber' | 'rose';
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  const accentMap = {
    emerald: 'from-emerald-500/40 via-emerald-500/5 to-transparent border-emerald-500/25',
    violet: 'from-violet-500/40 via-violet-500/5 to-transparent border-violet-500/25',
    cyan: 'from-cyan-500/40 via-cyan-500/5 to-transparent border-cyan-500/25',
    amber: 'from-amber-500/40 via-amber-500/5 to-transparent border-amber-500/25',
    rose: 'from-rose-500/40 via-rose-500/5 to-transparent border-rose-500/25',
  };

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-xl border bg-slate-950/60 backdrop-blur-sm',
        accentMap[accent],
        className,
      )}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="flex items-start justify-between gap-3 border-b border-white/5 px-4 py-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/90">
            {title}
          </h2>
          {subtitle ? <p className="mt-0.5 text-[11px] text-slate-400">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
