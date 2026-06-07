'use client';

import { AdminHeader } from './admin-header';
import { cn } from '@/lib/cn';

type Props = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  aside?: React.ReactNode;
};

export function AdminShell({
  title,
  subtitle,
  actions,
  children,
  className,
  aside,
}: Props) {
  return (
    <div className="flex h-screen max-h-screen min-h-0 flex-col overflow-hidden">
      <AdminHeader />

      <div className={cn('flex min-h-0 flex-1', aside ? 'lg:flex-row' : 'flex-col')}>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
          <div className="mx-auto w-full max-w-dashboard px-4 py-6 sm:px-6">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
                {subtitle ? (
                  <p className="mt-1 text-sm text-fg-muted">{subtitle}</p>
                ) : null}
              </div>
              {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
            </div>

            <div className={cn('space-y-6', className)}>{children}</div>
          </div>
        </div>

        {aside}
      </div>
    </div>
  );
}
