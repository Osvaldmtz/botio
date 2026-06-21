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

export function KpiSubNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 rounded-lg border border-bg-border bg-bg-subtle/50 p-1">
      {ITEMS.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active
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
