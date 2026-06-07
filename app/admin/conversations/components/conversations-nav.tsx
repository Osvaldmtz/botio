'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const VIEW_KEY = 'botio_admin_conversations_view';

export function ConversationsNav() {
  const pathname = usePathname();
  const isPipeline = pathname?.includes('/pipeline');
  const isExperiments = pathname?.includes('/experiments');

  useEffect(() => {
    if (isExperiments) return;
    localStorage.setItem(VIEW_KEY, isPipeline ? 'pipeline' : 'list');
  }, [isPipeline, isExperiments]);

  const tabClass = (active: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
      active
        ? 'bg-accent/15 text-accent border border-accent/40'
        : 'border border-bg-border text-fg-muted hover:text-fg'
    }`;

  return (
    <nav className="flex flex-wrap gap-2">
      <Link
        href="/admin/conversations"
        className={tabClass(!isPipeline && !isExperiments)}
      >
        Conversaciones
      </Link>
      <Link href="/admin/conversations/pipeline" className={tabClass(Boolean(isPipeline))}>
        Pipeline
      </Link>
      <Link href="/admin/experiments" className={tabClass(Boolean(isExperiments))}>
        Experimentos
      </Link>
    </nav>
  );
}
