# Conversations Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/admin/conversations` (list with filters) and `/admin/conversations/[id]` (full message thread) to the Botio admin dashboard.

**Architecture:** A PostgreSQL view (`conversation_summary`) aggregates message counts and last-message data for the list query. Two Server Component pages use `createAdminClient()` and `isAdmin()` following existing patterns. A Client Component handles filter state via URL search params. No webhook or schema changes needed — data is already being stored.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Supabase JS (service role), `next/navigation` for URL-based filter state.

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `supabase/migrations/0003_conversation_summary_view.sql` | PostgreSQL view for list query aggregates |
| Create | `components/admin/conversations-filter.tsx` | Client Component — filter bar, updates URL params |
| Create | `components/admin/conversation-thread.tsx` | Display component — chat bubble thread |
| Create | `app/admin/conversations/page.tsx` | Server Component — list page with filters |
| Create | `app/admin/conversations/[id]/page.tsx` | Server Component — message thread page |
| Modify | `components/admin/dashboard.tsx` | Add "Conversations" nav link in header |

---

## Task 1: SQL migration — conversation_summary view

**Files:**
- Create: `supabase/migrations/0003_conversation_summary_view.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/0003_conversation_summary_view.sql
-- Read-only view for the conversations list page.
-- Provides message_count, last_message_at, and last_message_content
-- without requiring multiple round-trips from the app layer.
create view public.conversation_summary as
select
  c.id,
  c.customer_phone,
  c.bot_id,
  c.created_at,
  b.name                                                as bot_name,
  count(m.id)::int                                      as message_count,
  max(m.created_at)                                     as last_message_at,
  (
    select m2.content
    from public.messages m2
    where m2.conversation_id = c.id
    order by m2.created_at desc
    limit 1
  )                                                     as last_message_content
from public.conversations c
join public.bots b on b.id = c.bot_id
left join public.messages m on m.conversation_id = c.id
group by c.id, c.customer_phone, c.bot_id, c.created_at, b.name;
```

- [ ] **Step 2: Apply the migration to Supabase**

Option A — Supabase CLI (if linked):
```bash
cd /Users/OsvaMtz/botio
npx supabase db push
```

Option B — Supabase dashboard SQL editor (paste the file contents and run).

Expected: no errors, view `conversation_summary` appears in the schema.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0003_conversation_summary_view.sql
git commit -m "feat: add conversation_summary view for dashboard list query"
```

---

## Task 2: ConversationsFilter Client Component

**Files:**
- Create: `components/admin/conversations-filter.tsx`

- [ ] **Step 1: Create the component**

```tsx
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
      {/* Bot filter */}
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

      {/* Phone filter */}
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

      {/* From date */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-fg-muted">From</label>
        <input
          type="date"
          value={currentFrom}
          onChange={(e) => updateParam('from', e.target.value)}
          className="rounded-md border border-bg-border bg-bg-elevated px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* To date */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-fg-muted">To</label>
        <input
          type="date"
          value={currentTo}
          onChange={(e) => updateParam('to', e.target.value)}
          className="rounded-md border border-bg-border bg-bg-elevated px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* Clear */}
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
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/OsvaMtz/botio && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/admin/conversations-filter.tsx
git commit -m "feat: add ConversationsFilter client component"
```

---

## Task 3: ConversationThread display component

**Files:**
- Create: `components/admin/conversation-thread.tsx`

- [ ] **Step 1: Create the component**

```tsx
type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

type Props = {
  messages: Message[];
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('es-MX', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ConversationThread({ messages }: Props) {
  if (messages.length === 0) {
    return <p className="text-sm text-fg-muted">No messages in this conversation.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {messages.map((msg) => {
        const isUser = msg.role === 'user';
        return (
          <div key={msg.id} className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[75%] ${isUser ? '' : 'items-end'} flex flex-col gap-1`}>
              <div
                className={`rounded-2xl px-4 py-2 text-sm text-fg ${
                  isUser ? 'rounded-tl-sm bg-bg-elevated' : 'rounded-tr-sm bg-accent/20'
                }`}
              >
                {msg.content}
              </div>
              <span className="px-1 text-xs text-fg-muted">{formatTime(msg.created_at)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/OsvaMtz/botio && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/admin/conversation-thread.tsx
git commit -m "feat: add ConversationThread display component"
```

---

## Task 4: Conversations list page

**Files:**
- Create: `app/admin/conversations/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import 'server-only';
import Link from 'next/link';
import { Suspense } from 'react';
import { isAdmin } from '@/lib/admin-auth';
import { LoginForm } from '@/components/admin/login-form';
import { createAdminClient } from '@/lib/supabase/admin';
import { ConversationsFilter } from '@/components/admin/conversations-filter';

export const dynamic = 'force-dynamic';

type SearchParams = {
  bot?: string;
  phone?: string;
  from?: string;
  to?: string;
};

type Props = { searchParams: SearchParams };

function truncate(text: string | null, len = 60) {
  if (!text) return '—';
  return text.length > len ? text.slice(0, len) + '…' : text;
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function ConversationsPage({ searchParams }: Props) {
  if (!isAdmin()) return <LoginForm />;

  const supabase = createAdminClient();
  const { bot = '', phone = '', from = '', to = '' } = searchParams;

  const [botsResult, convsResult] = await Promise.all([
    supabase.from('bots').select('id, name').order('name'),
    (async () => {
      let q = supabase
        .from('conversation_summary')
        .select('id, customer_phone, bot_id, bot_name, message_count, last_message_at, last_message_content')
        .order('last_message_at', { ascending: false });

      if (bot) q = q.eq('bot_id', bot);
      if (phone) q = q.ilike('customer_phone', `%${phone}%`);
      if (from) q = q.gte('last_message_at', from);
      if (to) q = q.lte('last_message_at', `${to}T23:59:59`);

      return q;
    })(),
  ]);

  const bots = botsResult.data ?? [];
  const conversations = convsResult.data ?? [];

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-fg">Conversations</h1>
          <p className="text-sm text-fg-muted">{conversations.length} result(s)</p>
        </div>
        <Link
          href="/admin"
          className="rounded-md border border-bg-border px-3 py-2 text-sm text-fg-muted hover:text-fg"
        >
          ← Admin
        </Link>
      </header>

      <Suspense>
        <ConversationsFilter
          bots={bots}
          currentBot={bot}
          currentPhone={phone}
          currentFrom={from}
          currentTo={to}
        />
      </Suspense>

      {conversations.length === 0 ? (
        <p className="text-sm text-fg-muted">No conversations match the current filters.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-bg-border">
          <table className="w-full text-sm">
            <thead className="border-b border-bg-border bg-bg-elevated">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-fg-muted">Bot</th>
                <th className="px-4 py-3 text-left font-medium text-fg-muted">Phone</th>
                <th className="px-4 py-3 text-left font-medium text-fg-muted">Messages</th>
                <th className="px-4 py-3 text-left font-medium text-fg-muted">Last message</th>
                <th className="px-4 py-3 text-left font-medium text-fg-muted">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bg-border">
              {conversations.map((c) => (
                <tr key={c.id} className="hover:bg-bg-elevated">
                  <td className="px-4 py-3 text-fg">{c.bot_name}</td>
                  <td className="px-4 py-3 font-mono text-fg">{c.customer_phone}</td>
                  <td className="px-4 py-3 text-fg-muted">{c.message_count}</td>
                  <td className="px-4 py-3 text-fg-muted">
                    {truncate(c.last_message_content)}
                  </td>
                  <td className="px-4 py-3 text-fg-muted">{formatDate(c.last_message_at)}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/conversations/${c.id}`}
                      className="text-accent hover:text-accent-hover text-xs"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/OsvaMtz/botio && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/admin/conversations/page.tsx
git commit -m "feat: add /admin/conversations list page with filters"
```

---

## Task 5: Conversation thread page

**Files:**
- Create: `app/admin/conversations/[id]/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import 'server-only';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isAdmin } from '@/lib/admin-auth';
import { LoginForm } from '@/components/admin/login-form';
import { createAdminClient } from '@/lib/supabase/admin';
import { ConversationThread } from '@/components/admin/conversation-thread';

export const dynamic = 'force-dynamic';

type Props = { params: { id: string } };

export default async function ConversationPage({ params }: Props) {
  if (!isAdmin()) return <LoginForm />;

  const supabase = createAdminClient();
  const { id } = params;

  const [summaryResult, messagesResult] = await Promise.all([
    supabase
      .from('conversation_summary')
      .select('customer_phone, bot_name')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true }),
  ]);

  if (!summaryResult.data) notFound();

  const { customer_phone, bot_name } = summaryResult.data;
  const messages = (messagesResult.data ?? []) as Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
  }>;

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-10">
      <header className="mb-8">
        <Link
          href="/admin/conversations"
          className="mb-4 inline-block text-sm text-fg-muted hover:text-fg"
        >
          ← Conversations
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-mono text-xl font-bold text-fg">{customer_phone}</h1>
            <p className="text-sm text-fg-muted">{bot_name}</p>
          </div>
          <span className="text-xs text-fg-muted">{messages.length} messages</span>
        </div>
      </header>

      <ConversationThread messages={messages} />
    </main>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/OsvaMtz/botio && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/admin/conversations/[id]/page.tsx
git commit -m "feat: add /admin/conversations/[id] thread page"
```

---

## Task 6: Add Conversations nav link in Dashboard

**Files:**
- Modify: `components/admin/dashboard.tsx`

- [ ] **Step 1: Add the Link import and nav item**

In `components/admin/dashboard.tsx`, add `import Link from 'next/link';` at the top, then add a "Conversations" link in the header next to the logout button:

Find this block in the header:
```tsx
        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded-md border border-bg-border px-3 py-2 text-sm text-fg-muted hover:text-fg"
          >
            Log out
          </button>
        </form>
```

Replace with:
```tsx
        <div className="flex items-center gap-3">
          <Link
            href="/admin/conversations"
            className="rounded-md border border-bg-border px-3 py-2 text-sm text-fg-muted hover:text-fg"
          >
            Conversations
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-md border border-bg-border px-3 py-2 text-sm text-fg-muted hover:text-fg"
            >
              Log out
            </button>
          </form>
        </div>
```

- [ ] **Step 2: Add the Link import at top of file**

Add `import Link from 'next/link';` after the existing imports.

- [ ] **Step 3: Type-check**

```bash
cd /Users/OsvaMtz/botio && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/admin/dashboard.tsx
git commit -m "feat: add Conversations nav link in admin dashboard header"
```

---

## Task 7: Verify end-to-end in dev server

- [ ] **Step 1: Start dev server**

```bash
cd /Users/OsvaMtz/botio && npm run dev
```

- [ ] **Step 2: Verify list page**

Open `http://localhost:3000/admin/conversations`. Expected:
- Shows list of conversations (or empty state if no data yet)
- Filter controls visible: bot select, phone input, from/to date
- Each row has a "View →" link

- [ ] **Step 3: Verify filters**

Select a bot in the dropdown. Expected: URL updates to `?bot=<uuid>`, table filters.

- [ ] **Step 4: Verify thread page**

Click "View →" on any row. Expected:
- Shows phone + bot name in header
- Messages displayed as chat bubbles (user left, bot right)
- "← Conversations" link returns to list

- [ ] **Step 5: Verify nav link**

Go to `http://localhost:3000/admin`. Expected: "Conversations" button visible in header next to "Log out".
