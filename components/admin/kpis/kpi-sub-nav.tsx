'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

const ITEMS = [
  { href: '/admin/kpis', label: 'Resumen', exact: true, color: '#10B981' },
  { href: '/admin/kpis/whatsapp', label: 'WhatsApp', color: '#F43F5E' },
  { href: '/admin/kpis/instagram', label: 'Instagram', color: '#D946EF' },
  { href: '/admin/kpis/ads', label: 'Ads', color: '#F59E0B' },
  { href: '/admin/kpis/web', label: 'Web', color: '#0EA5E9' },
  { href: '/admin/kpis/pagespeed', label: 'PageSpeed', color: '#14B8A6' },
  { href: '/admin/kpis/revenue', label: 'Revenue', color: '#6366F1' },
  { href: '/admin/kpis/insights', label: 'Análisis IA', color: '#8B5CF6' },
];

export function KpiSubNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-5 flex flex-wrap gap-2">
      {ITEMS.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-semibold transition-all',
              active
                ? 'text-white shadow-md'
                : 'border border-bg-border bg-bg text-fg-muted hover:border-transparent hover:text-fg',
            )}
            style={active ? { backgroundColor: item.color } : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
