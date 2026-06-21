import { cn } from '@/lib/cn';
import { VIVID, type VividAccent } from './palette';

type Props = {
  title: string;
  subtitle?: string;
  accent?: VividAccent;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
};

export function KpiVividPanel({ title, subtitle, accent = 'emerald', children, className, action }: Props) {
  const c = VIVID[accent];
  return (
    <section className={cn('overflow-hidden rounded-2xl border border-bg-border bg-bg shadow-sm', className)}>
      <div
        className="flex items-start justify-between gap-3 px-5 py-4"
        style={{ background: `linear-gradient(90deg, ${c.light} 0%, transparent 100%)` }}
      >
        <div>
          <h2 className="text-sm font-semibold" style={{ color: c.text }}>
            {title}
          </h2>
          {subtitle ? <p className="mt-0.5 text-xs text-fg-muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className="border-t border-bg-border px-5 py-4">{children}</div>
    </section>
  );
}

export function KpiVividSectionTitle({
  children,
  accent = 'emerald',
}: {
  children: React.ReactNode;
  accent?: VividAccent;
}) {
  const c = VIVID[accent];
  return (
    <h3
      className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
      style={{ color: c.text }}
    >
      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: c.from }} />
      {children}
    </h3>
  );
}
