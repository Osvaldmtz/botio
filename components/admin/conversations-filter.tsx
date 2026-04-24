'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

type Bot = { id: string; name: string };

type Props = {
  bots: Bot[];
  currentBot: string;
  currentPhone: string;
  currentFrom: string;
  currentTo: string;
};

export function ConversationsFilter({
  bots,
  currentBot,
  currentPhone,
  currentFrom,
  currentTo,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const clearAll = () => router.push(pathname);

  const hasFilters = currentBot || currentPhone || currentFrom || currentTo;

  return (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-fg-muted">Bot</label>
        <select
          value={currentBot}
          onChange={(e) => updateParam('bot', e.target.value)}
          className="rounded-md border border-bg-border bg-bg-elevated px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">All bots</option>
          {bots.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-fg-muted">Phone</label>
        <input
          type="text"
          placeholder="Search number…"
          value={currentPhone}
          onChange={(e) => updateParam('phone', e.target.value)}
          className="rounded-md border border-bg-border bg-bg-elevated px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-fg-muted">From</label>
        <input
          type="date"
          value={currentFrom}
          onChange={(e) => updateParam('from', e.target.value)}
          className="rounded-md border border-bg-border bg-bg-elevated px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-fg-muted">To</label>
        <input
          type="date"
          value={currentTo}
          onChange={(e) => updateParam('to', e.target.value)}
          className="rounded-md border border-bg-border bg-bg-elevated px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {hasFilters && (
        <button
          onClick={clearAll}
          className="rounded-md border border-bg-border px-3 py-2 text-sm text-fg-muted hover:text-fg"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
