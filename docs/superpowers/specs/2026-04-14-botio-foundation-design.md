# Botio — Sub-project 1: Foundation (Design Spec)

**Date:** 2026-04-14
**Status:** Approved for planning
**Parent project:** Botio — WhatsApp AI bot SaaS
**Sub-project scope:** Scaffold + DB schema + branding base + placeholder page

---

## 1. Context

Botio is a SaaS that lets businesses create WhatsApp bots powered by Claude to handle leads automatically. The full product has 5 sub-projects; this spec covers only **Sub-project 1: Foundation**. It delivers a buildable, runnable Next.js project with the database schema, RLS, branding tokens, Supabase client helpers, and a minimal placeholder page at `/`. No auth, no landing, no dashboard, no webhook.

Later sub-projects: 2. Landing page + Google OAuth 3. Dashboard + onboarding wizard 4. `/api/webhook/[botId]` (Twilio ↔ Claude) 5. Realtime conversations panel

## 2. Stack decisions

| Item            | Decision                                                         |
| --------------- | ---------------------------------------------------------------- |
| Framework       | Next.js 14 App Router                                            |
| Language        | TypeScript (strict)                                              |
| Styling         | Tailwind CSS                                                     |
| Runtime         | Node 20 LTS                                                      |
| Package manager | npm                                                              |
| Database        | Supabase Cloud                                                   |
| Supabase client | `@supabase/ssr` + `@supabase/supabase-js`                        |
| Fonts           | Geist Sans + Geist Mono via `next/font`                          |
| Lint/format     | ESLint (Next default) + Prettier + `prettier-plugin-tailwindcss` |
| Testing         | None in this sub-project (added in sub-project 4)                |
| Theme           | Dark fixed (no toggle)                                           |

## 3. Repository layout

```
botio/
├── app/
│   ├── layout.tsx            # fonts, metadata, dark body
│   ├── page.tsx              # placeholder: logo + wordmark + tagline
│   └── globals.css           # tailwind base
├── components/
│   └── logo.tsx              # inline SVG robot, uses currentColor
├── lib/
│   └── supabase/
│       ├── client.ts         # createBrowserClient
│       ├── server.ts         # createServerClient (cookies via next/headers)
│       └── middleware.ts     # createMiddlewareClient helper
├── supabase/
│   └── migrations/
│       └── 0001_init.sql     # tables + RLS
├── middleware.ts             # no-op placeholder (ready for auth in sub-project 2)
├── tailwind.config.ts
├── .env.local.example
├── .gitignore                # includes .env.local
├── package.json
├── tsconfig.json
├── next.config.mjs
└── README.md
```

**Principles**

- `lib/supabase/` is the single boundary around Supabase. All future code imports clients from here.
- `components/logo.tsx` takes a `className` prop and uses `currentColor` so size and color are controlled by consumers.
- `middleware.ts` exists empty so sub-project 2 only edits, never creates.
- No `src/` directory.

## 4. Database schema

Single migration file: `supabase/migrations/0001_init.sql`. Applied manually in Supabase Cloud SQL editor (or via `supabase db push` if CLI is linked).

### 4.1 Tables

```sql
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  logo_url text,
  primary_color text default '#00FF88',
  created_at timestamptz not null default now()
);

create table public.bots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  system_prompt text not null default '',
  twilio_account_sid text,
  twilio_auth_token text,          -- TODO: encrypt with pgsodium/Vault before production
  twilio_whatsapp_number text,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots(id) on delete cascade,
  customer_phone text not null,
  created_at timestamptz not null default now(),
  unique (bot_id, customer_phone)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index on public.bots (business_id);
create index on public.conversations (bot_id);
create index on public.messages (conversation_id, created_at);
```

### 4.2 Row Level Security

All four tables have RLS enabled. The ownership chain is:
`messages → conversations → bots → businesses.owner_id → auth.uid()`.

```sql
alter table public.businesses    enable row level security;
alter table public.bots          enable row level security;
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;

create policy "owner_all_businesses" on public.businesses
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "owner_all_bots" on public.bots
  for all using (exists (
    select 1 from public.businesses b
    where b.id = bots.business_id and b.owner_id = auth.uid()
  )) with check (exists (
    select 1 from public.businesses b
    where b.id = bots.business_id and b.owner_id = auth.uid()
  ));

create policy "owner_all_conversations" on public.conversations
  for all using (exists (
    select 1 from public.bots bo
    join public.businesses b on b.id = bo.business_id
    where bo.id = conversations.bot_id and b.owner_id = auth.uid()
  ));

create policy "owner_all_messages" on public.messages
  for all using (exists (
    select 1 from public.conversations c
    join public.bots bo on bo.id = c.bot_id
    join public.businesses b on b.id = bo.business_id
    where c.id = messages.conversation_id and b.owner_id = auth.uid()
  ));
```

### 4.3 Schema notes

- Webhook (sub-project 4) will use the **service role key** to bypass RLS for inserting `conversations` and `messages` without a user session. Documented here; no webhook code ships in this sub-project.
- `unique (bot_id, customer_phone)` enables upsert on incoming messages — one live conversation per customer per bot. If "close conversation" is added later, add `closed_at` and change the unique to partial `where closed_at is null`.
- `gen_random_uuid()` is provided by `pgcrypto`, already enabled on Supabase projects.
- No triggers or stored functions — YAGNI.

## 5. Branding and design tokens

### 5.1 Tailwind config

```ts
// tailwind.config.ts (extract)
theme: {
  extend: {
    colors: {
      bg:       { DEFAULT: '#0A0A0B', elevated: '#111113', border: '#1F1F23' },
      fg:       { DEFAULT: '#F4F4F5', muted: '#A1A1AA' },
      accent:   { DEFAULT: '#00FF88', hover: '#00E67A' },
      electric: { DEFAULT: '#3B82F6', hover: '#2563EB' },
    },
    backgroundImage: {
      'gradient-brand': 'linear-gradient(135deg, #00FF88 0%, #3B82F6 100%)',
      'gradient-glow':  'radial-gradient(circle at 50% 0%, rgba(0,255,136,0.15), transparent 60%)',
    },
    fontFamily: {
      sans: ['var(--font-geist-sans)'],
      mono: ['var(--font-geist-mono)'],
    },
  },
}
```

`globals.css` contains only Tailwind's three directives and a minimal reset. No custom CSS variables — tokens live in Tailwind config.

### 5.2 Logo

`components/logo.tsx` — inline SVG, ~40 lines, square viewBox, `fill="currentColor"`. Shape: rounded-rectangle head, two circle eyes, short antenna with a small ball on top, subtle smile. Single color (inherits from text color). No gradients inside the SVG; gradients are applied by parent via `bg-gradient-brand bg-clip-text text-transparent` when needed.

Props: `className?: string`. No other props.

### 5.3 Root layout (`app/layout.tsx`)

- Loads Geist Sans and Geist Mono via `next/font/google`, exposes them as CSS variables.
- `<html lang="en" className="dark">`.
- `<body className="bg-bg text-fg font-sans antialiased">`.
- Metadata: `title: "Botio — WhatsApp AI for your business"`, short description, favicon from the logo.

### 5.4 Placeholder page (`app/page.tsx`)

- Full-viewport centered content: `<main className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gradient-glow">`.
- `<Logo className="w-20 h-20 text-accent" />`
- `<h1>` "Botio" with `bg-gradient-brand bg-clip-text text-transparent` + large font.
- `<p>` "WhatsApp AI for your business" in `text-fg-muted`.
- No CTAs, no links, no header, no footer.

## 6. Supabase client helpers

### 6.1 `lib/supabase/client.ts`

Exports `createClient()` that calls `createBrowserClient` from `@supabase/ssr` using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. For use in `'use client'` components.

### 6.2 `lib/supabase/server.ts`

Exports `createClient()` that calls `createServerClient` from `@supabase/ssr`, reading and writing cookies via `next/headers`' `cookies()` helper. For use in server components and route handlers.

### 6.3 `lib/supabase/middleware.ts`

Exports a helper that, given a `NextRequest`, creates a middleware-flavored Supabase client and returns both the client and an updated `NextResponse` with refreshed auth cookies. Called from `middleware.ts` in later sub-projects.

**None of these are called by any component in this sub-project.** They exist and must type-check. Sub-project 2 wires them into auth.

## 7. Environment variables

`.env.local.example` (committed):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`.env.local` is gitignored. The service role key is declared now but unused in this sub-project; sub-project 4 uses it for the webhook.

## 8. README

Setup steps:

1. `npm install`
2. Create a Supabase Cloud project; copy Project URL, anon key, service role key.
3. Open Supabase SQL editor and run `supabase/migrations/0001_init.sql`.
4. `cp .env.local.example .env.local` and paste keys.
5. `npm run dev` → open `http://localhost:3000`.

Also includes: project summary, stack list, directory map, link to this spec.

## 9. Definition of Done

- [ ] `npm run dev` starts with no errors; `/` renders the placeholder (logo + "Botio" + tagline) on dark background.
- [ ] `npm run build` completes with no TypeScript or ESLint errors.
- [ ] `npm run lint` passes.
- [ ] `supabase/migrations/0001_init.sql` applies cleanly to an empty Supabase project; all four tables exist with RLS enabled.
- [ ] Manual smoke test in SQL editor: `select * from public.businesses` as `anon` returns zero rows / is blocked by RLS.
- [ ] `.env.local` is gitignored; `.env.local.example` is committed.
- [ ] Supabase client helpers type-check even though unused.

## 10. Out of scope (explicit)

- Google OAuth and any auth UI (sub-project 2)
- Real landing page with hero / features / CTA (sub-project 2)
- Dashboard, onboarding wizard, bot creation UI (sub-project 3)
- Webhook, Claude integration, Twilio integration (sub-project 4)
- Realtime conversation panel (sub-project 5)
- Encryption of `twilio_auth_token` — tracked as TODO in the schema comment; must be resolved before production but not in this sub-project
- Automated tests — added in sub-project 4

## 11. Known risks / TODOs

- **Plaintext Twilio credentials.** Acceptable for MVP under strict RLS, but must be migrated to `pgsodium` / Supabase Vault before real production traffic. Tracked in the schema comment and here.
- **Service role key on the client is forbidden.** The webhook in sub-project 4 must only use it server-side. Documented here so the boundary is clear.
- **Single-tenant ownership.** `businesses.owner_id` ties each business to exactly one user. Multi-user teams require a future `business_members` table; not a breaking change.
