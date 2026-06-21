'use client';

import { useEffect, useState } from 'react';

export function TasksNavBadge() {
  const [overdue, setOverdue] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/tasks?stats_only=1');
        if (!res.ok) return;
        const data = (await res.json()) as { stats: { overdue: number } };
        if (!cancelled) setOverdue(data.stats.overdue);
      } catch {
        // ignore
      }
    }
    void load();
    const id = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  if (overdue <= 0) return null;

  return (
    <span className="ml-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
      {overdue > 99 ? '99+' : overdue}
    </span>
  );
}
