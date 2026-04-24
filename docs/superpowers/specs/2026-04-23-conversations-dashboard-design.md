# Conversations Dashboard — Design Spec
Date: 2026-04-23

## Context

Botio already stores every message exchanged between bots and users in two normalized tables:
- `conversations` — one row per thread, keyed on `(bot_id, customer_phone)`
- `messages` — one row per message with `role` (`user`/`assistant`), `content`, `created_at`

Both the Twilio and Meta webhooks already write to these tables on every exchange. No migration or webhook changes are required.

## Scope

Add two pages to the existing `/admin` dashboard:
1. `/admin/conversations` — global list of all conversations across all bots, with filters
2. `/admin/conversations/[id]` — full message thread for a single conversation

## Routes

### `/admin/conversations`

- **Auth:** Same `isAdmin()` check used by `/admin/page.tsx`. Redirects to login if not admin.
- **Component pattern:** Server Component using `createAdminClient()`.
- **Data:** Fetches `conversations` joined with `bots` (for bot name) and a subquery/aggregate for:
  - total message count per conversation
  - content and `created_at` of the most recent message
- **Order:** Most recent message first (descending).
- **Filters (via URL `searchParams`):**
  - `bot` — exact `bot_id` UUID, populated from a select of all bots
  - `phone` — partial match (`ILIKE %value%`) on `customer_phone`
  - `from` / `to` — date range filter on the most recent message timestamp
- **UI:**
  - Filter bar at top: Bot select · Phone input · From date · To date · Clear button
  - Table columns: Bot · Phone · Messages (count) · Last message (truncated preview) · Date
  - Each row links to `/admin/conversations/[id]`

### `/admin/conversations/[id]`

- **Auth:** Same `isAdmin()` check.
- **Data:** Fetches all messages for the given `conversation_id`, ordered `created_at ASC`. Also fetches the parent conversation + bot name for the header.
- **UI:**
  - Header: customer phone · bot name · "← Back" link to `/admin/conversations`
  - Chat thread: user messages left-aligned (dark background bubble), bot messages right-aligned (accent color bubble)
  - Timestamp shown below each bubble
  - Scrolls from top (oldest first)

## File Structure

```
app/
  admin/
    conversations/
      page.tsx              ← list page (Server Component)
      [id]/
        page.tsx            ← thread page (Server Component)
components/
  admin/
    conversations-table.tsx ← table + filter bar (Client Component for filter interactivity)
    conversation-thread.tsx ← chat bubbles (pure display, no client state needed)
```

## Data Queries

**List view** — a migration adds a PostgreSQL view `conversation_summary` that the list page queries via Supabase JS:

```sql
create view public.conversation_summary as
select
  c.id,
  c.customer_phone,
  c.bot_id,
  c.created_at,
  b.name            as bot_name,
  count(m.id)       as message_count,
  max(m.created_at) as last_message_at,
  (array_agg(m.content order by m.created_at desc))[1] as last_message_content
from public.conversations c
join public.bots b on b.id = c.bot_id
left join public.messages m on m.conversation_id = c.id
group by c.id, c.customer_phone, c.bot_id, c.created_at, b.name;
```

The list page queries this view with Supabase JS, applying filters and ordering by `last_message_at desc`. This view is read-only and accessed via the service-role key (admin only).

**Thread query**:
```ts
supabase
  .from('messages')
  .select('id, role, content, created_at')
  .eq('conversation_id', id)
  .order('created_at', { ascending: true })
```

## Styling

Follows the existing dark-theme Tailwind config. No new design tokens. Accent color reuses `primary_color` from the business or falls back to the default `#00FF88`. Chat bubbles use rounded corners (`rounded-2xl`), consistent with a WhatsApp-style thread.

## Out of Scope

- Pagination (deferred — implement if message volume requires it)
- Real-time updates (deferred)
- Sending messages from the dashboard
- Exporting conversations to CSV
