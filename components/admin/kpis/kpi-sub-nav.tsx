'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

const ITEMS = [
  { href: '/admin/kpis', label: 'Resumen', exact: true },
  { href: '/admin/kpis/whatsapp', label: 'WhatsApp' },
  { href: '/admin/kpis/instagram', label: 'Instagram' },
  { href: '/admin/kpis/ads', label: 'Ads' },
  { href: '/admin/kpis/web', label: 'Web' },
  { href: '/admin/kpis/revenue', label: 'Revenue' },
  { href: '/admin/kpis/insights', label: 'Análisis IA' },
];

export function KpiSubNav({ jarvis }: { jarvis?: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        'mb-4 flex flex-wrap gap-1 rounded-xl p-1',
        jarvis
          ? 'border border-cyan-500/20 bg-slate-950/80 backdrop-blur-sm'
          : 'rounded-lg border border-bg-border bg-bg-subtle/50',
      )}
    >
      {ITEMS.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              jarvis
                ? active
                  ? 'bg-emerald-500/15 text-emerald-200 shadow-[0_0_16px_rgba(16,185,129,0.25)]'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                : active
                  ? 'bg-bg text-fg shadow-sm'
                  : 'text-fg-muted hover:bg-bg hover:text-fg',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
