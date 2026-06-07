'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, Settings } from 'lucide-react';
import { Tabs } from '@/components/ui/tabs';
import { logoutAction } from '@/app/admin/actions';

export function AdminHeader() {
  const pathname = usePathname();
  const isPipeline = pathname?.includes('/pipeline');
  const isExperiments = pathname?.includes('/experiments');
  const isDemos = pathname?.includes('/demos');
  const isOnboarding = pathname?.includes('/trial-onboarding');
  const isObjections = pathname?.includes('/objections');
  const isConversations =
    pathname?.startsWith('/admin/conversations') && !isPipeline;

  const tabs = [
    {
      href: '/admin/conversations',
      label: 'Conversaciones',
      active: isConversations || (pathname === '/admin/conversations'),
    },
    {
      href: '/admin/conversations/pipeline',
      label: 'Pipeline',
      active: isPipeline,
    },
    {
      href: '/admin/demos',
      label: 'Demos',
      active: isDemos,
    },
    {
      href: '/admin/trial-onboarding',
      label: 'Onboarding',
      active: isOnboarding,
    },
    {
      href: '/admin/objections',
      label: 'Objeciones',
      active: isObjections,
    },
    {
      href: '/admin/experiments',
      label: 'Experimentos',
      active: isExperiments,
    },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-bg-border bg-bg">
      <div className="mx-auto flex h-14 max-w-dashboard items-center gap-6 px-4 sm:px-6">
        <Link href="/admin" className="flex shrink-0 items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-accent text-xs font-semibold text-white">
            B
          </span>
          <span className="text-sm font-semibold tracking-tight text-fg">Botio</span>
        </Link>

        <div className="hidden flex-1 justify-center md:flex">
          <Tabs items={tabs} />
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Link
            href="/admin/calendar-settings"
            className="flex h-8 w-8 items-center justify-center rounded text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg"
            title="Google Calendar"
          >
            <Settings className="h-4 w-4" strokeWidth={1.5} />
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex h-8 w-8 items-center justify-center rounded text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </form>
        </div>
      </div>

      <div className="border-t border-bg-border px-4 py-2 md:hidden">
        <Tabs items={tabs} />
      </div>
    </header>
  );
}
