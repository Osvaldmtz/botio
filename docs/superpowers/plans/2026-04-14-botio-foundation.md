# Botio Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Botio Next.js project with TypeScript, Tailwind, Supabase client helpers, branded dark theme, a placeholder home page, and versioned DB schema + RLS — leaving a buildable baseline for subsequent sub-projects.

**Architecture:** Next.js 14 App Router, server-first. Supabase Cloud accessed via `@supabase/ssr` (browser / server / middleware clients) isolated behind `lib/supabase/`. Tailwind tokens carry all branding (dark bg, neon green + electric blue gradients). DB schema in a single versioned migration with row-level security chained to `auth.uid()` via `businesses.owner_id`.

**Tech Stack:** Next.js 14, TypeScript (strict), Tailwind CSS, `@supabase/ssr`, `@supabase/supabase-js`, Geist fonts, Prettier + `prettier-plugin-tailwindcss`, Node 20, npm.

**Note on TDD:** This sub-project contains no runtime logic — only scaffold, types, styles, and SQL. There is nothing meaningful to unit-test. Verification steps therefore use `npm run build`, `npm run lint`, `npx tsc --noEmit`, and manual visual checks instead of test runs. Automated tests are introduced in sub-project 4 (webhook) where real logic exists.

**Spec:** `docs/superpowers/specs/2026-04-14-botio-foundation-design.md`

---

## File Structure

**Created in this plan:**

- `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `.eslintrc.json` — scaffolded by `create-next-app`, then edited
- `.gitignore`, `.prettierrc`, `.prettierignore`
- `.env.local.example`
- `app/layout.tsx` — root layout, fonts, metadata, dark body (edited from scaffold)
- `app/page.tsx` — placeholder landing (edited from scaffold)
- `app/globals.css` — minimal Tailwind base (edited from scaffold)
- `components/logo.tsx` — inline SVG robot
- `lib/supabase/client.ts` — browser client
- `lib/supabase/server.ts` — server/route-handler client
- `lib/supabase/middleware.ts` — middleware helper
- `middleware.ts` — no-op root middleware placeholder
- `supabase/migrations/0001_init.sql` — tables + RLS
- `README.md`
- `docs/superpowers/specs/2026-04-14-botio-foundation-design.md` — already exists
- `docs/superpowers/plans/2026-04-14-botio-foundation.md` — this file

**Not created (out of scope, reserved for later sub-projects):**

- Any auth UI, OAuth handlers, dashboard pages, onboarding wizard, webhook route, realtime panel, tests.

---

## Task 1: Initialize Next.js project and git repository

**Files:**

- Create: entire Next.js scaffold in `/Users/OsvaMtz/botio`
- Create: `.git/`

- [ ] **Step 1: Verify working directory is empty**

Run: `ls -la /Users/OsvaMtz/botio`
Expected: only `.` and `..` (plus the `docs/` folder already created during brainstorming). If other files exist, stop and ask.

- [ ] **Step 2: Scaffold Next.js 14 with TypeScript, Tailwind, ESLint, App Router, no src/**

Run from `/Users/OsvaMtz/botio`:

```bash
npx --yes create-next-app@14.2.18 . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --use-npm
```

If the CLI complains that the directory is non-empty because of `docs/`, re-run with `--skip-install` temporarily removed is **not** an option — instead, pass `--yes` and accept the "non-empty directory" prompt. If `create-next-app` refuses outright, temporarily move `docs/` out, scaffold, move it back:

```bash
mv docs /tmp/botio-docs-stash
npx --yes create-next-app@14.2.18 . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm
mv /tmp/botio-docs-stash docs
```

Expected: `package.json`, `app/`, `tailwind.config.ts`, `tsconfig.json`, `next.config.mjs`, `postcss.config.mjs`, `.eslintrc.json`, `.gitignore`, `node_modules/` exist.

- [ ] **Step 3: Pin Node engine in package.json**

Add to `package.json`:

```json
"engines": {
  "node": ">=20.0.0"
}
```

- [ ] **Step 4: Verify dev server starts**

Run: `npm run dev`
Expected: server starts on `http://localhost:3000` without errors. Press Ctrl+C to stop.

- [ ] **Step 5: Initialize git and make first commit**

```bash
git init
git add -A
git commit -m "chore: scaffold Next.js 14 with TS, Tailwind, ESLint, App Router"
```

Expected: one commit, working tree clean.

---

## Task 2: Add Prettier and confirm gitignore

**Files:**

- Create: `.prettierrc`
- Create: `.prettierignore`
- Modify: `package.json` (add deps + script)
- Verify: `.gitignore` already ignores `.env*.local`

- [ ] **Step 1: Install Prettier and Tailwind plugin**

Run:

```bash
npm install --save-dev prettier prettier-plugin-tailwindcss
```

- [ ] **Step 2: Create `.prettierrc`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

- [ ] **Step 3: Create `.prettierignore`**

```
node_modules
.next
out
supabase/migrations
```

- [ ] **Step 4: Add format script to `package.json`**

In `package.json` under `"scripts"`, add:

```json
"format": "prettier --write .",
"format:check": "prettier --check ."
```

- [ ] **Step 5: Run formatter over the scaffold**

Run: `npm run format`
Expected: files formatted, no errors.

- [ ] **Step 6: Verify `.gitignore` ignores env files**

Open `.gitignore`. Confirm the following line exists (create-next-app adds it by default):

```
# local env files
.env*.local
```

If missing, append it.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: add Prettier with Tailwind plugin"
```

---

## Task 3: Configure Tailwind design tokens

**Files:**

- Modify: `tailwind.config.ts` (full replacement)
- Modify: `app/globals.css` (minimal replacement)

- [ ] **Step 1: Replace `tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0A0A0B',
          elevated: '#111113',
          border: '#1F1F23',
        },
        fg: {
          DEFAULT: '#F4F4F5',
          muted: '#A1A1AA',
        },
        accent: {
          DEFAULT: '#00FF88',
          hover: '#00E67A',
        },
        electric: {
          DEFAULT: '#3B82F6',
          hover: '#2563EB',
        },
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #00FF88 0%, #3B82F6 100%)',
        'gradient-glow': 'radial-gradient(circle at 50% 0%, rgba(0,255,136,0.15), transparent 60%)',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 2: Replace `app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html,
body {
  height: 100%;
}
```

- [ ] **Step 3: Verify type-check and build still pass**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(style): add Tailwind design tokens for dark theme and brand gradients"
```

---

## Task 4: Root layout with Geist fonts and metadata

**Files:**

- Modify: `app/layout.tsx` (full replacement)

- [ ] **Step 1: Replace `app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

export const metadata: Metadata = {
  title: 'Botio — WhatsApp AI for your business',
  description: 'Build WhatsApp bots powered by Claude to handle leads automatically.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-bg text-fg font-sans antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Install the `geist` font package**

Run:

```bash
npm install geist
```

Note: the `geist` package exposes `GeistSans` and `GeistMono` as `next/font` objects with ready-to-use CSS variables `--font-geist-sans` and `--font-geist-mono`, which match the Tailwind `fontFamily` config from Task 3.

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(layout): wire Geist fonts, dark theme, and metadata in root layout"
```

---

## Task 5: Logo component

**Files:**

- Create: `components/logo.tsx`

- [ ] **Step 1: Create `components/logo.tsx`**

```tsx
type LogoProps = {
  className?: string;
  'aria-label'?: string;
};

export function Logo({ className, ...rest }: LogoProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      role="img"
      aria-label={rest['aria-label'] ?? 'Botio logo'}
    >
      {/* antenna */}
      <line
        x1="32"
        y1="6"
        x2="32"
        y2="14"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="32" cy="5" r="3" fill="currentColor" />
      {/* head */}
      <rect
        x="10"
        y="14"
        width="44"
        height="38"
        rx="10"
        ry="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      {/* eyes */}
      <circle cx="24" cy="31" r="3.5" fill="currentColor" />
      <circle cx="40" cy="31" r="3.5" fill="currentColor" />
      {/* smile */}
      <path
        d="M22 40 Q32 48 42 40"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/logo.tsx
git commit -m "feat(logo): add inline SVG robot logo component"
```

---

## Task 6: Placeholder home page

**Files:**

- Modify: `app/page.tsx` (full replacement)

- [ ] **Step 1: Replace `app/page.tsx`**

```tsx
import { Logo } from '@/components/logo';

export default function HomePage() {
  return (
    <main className="bg-gradient-glow flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo className="text-accent h-20 w-20" />
      <h1 className="bg-gradient-brand bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-6xl">
        Botio
      </h1>
      <p className="text-fg-muted max-w-md text-lg">WhatsApp AI for your business.</p>
    </main>
  );
}
```

- [ ] **Step 2: Run dev server and visually verify**

Run: `npm run dev`
Open `http://localhost:3000`.
Expected: dark background, green neon robot logo centered, "Botio" wordmark with green-to-blue gradient, muted tagline below. Stop server with Ctrl+C.

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat(home): add branded placeholder landing page"
```

---

## Task 7: Supabase client helpers

**Files:**

- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/middleware.ts`
- Create: `middleware.ts`

- [ ] **Step 1: Install Supabase packages**

Run:

```bash
npm install @supabase/ssr @supabase/supabase-js
```

- [ ] **Step 2: Create `lib/supabase/client.ts`**

```ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 3: Create `lib/supabase/server.ts`**

```ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Called from a Server Component — setting cookies is ignored.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // Called from a Server Component — setting cookies is ignored.
          }
        },
      },
    },
  );
}
```

- [ ] **Step 4: Create `lib/supabase/middleware.ts`**

```ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export function createClient(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    },
  );

  return { supabase, response };
}
```

- [ ] **Step 5: Create `middleware.ts` (root, no-op placeholder)**

```ts
import { NextResponse, type NextRequest } from 'next/server';

export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

Note: this middleware does nothing yet. Sub-project 2 will replace the body with a call to `lib/supabase/middleware.ts#createClient` to refresh auth cookies.

- [ ] **Step 6: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. The unused helpers are fine — they are a library boundary.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(supabase): add browser, server, and middleware client helpers"
```

---

## Task 8: Environment variable template

**Files:**

- Create: `.env.local.example`

- [ ] **Step 1: Create `.env.local.example`**

```
# Supabase — get from https://supabase.com/dashboard/project/_/settings/api
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Server-only. Never expose to the browser. Used by the webhook in sub-project 4.
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 2: Confirm `.env.local` is gitignored**

Run: `git check-ignore -v .env.local`
Expected: output showing `.gitignore` matches `.env*.local` (even though the file doesn't exist yet, the rule is printed).

- [ ] **Step 3: Commit**

```bash
git add .env.local.example
git commit -m "chore: add env var template"
```

---

## Task 9: Database migration — tables and RLS

**Files:**

- Create: `supabase/migrations/0001_init.sql`

- [ ] **Step 1: Create `supabase/migrations/0001_init.sql`**

```sql
-- Botio initial schema
-- Ownership chain: messages -> conversations -> bots -> businesses.owner_id -> auth.uid()

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
  twilio_auth_token text, -- TODO: encrypt with pgsodium/Vault before production
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

alter table public.businesses    enable row level security;
alter table public.bots          enable row level security;
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;

create policy "owner_all_businesses" on public.businesses
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "owner_all_bots" on public.bots
  for all
  using (
    exists (
      select 1 from public.businesses b
      where b.id = bots.business_id and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = bots.business_id and b.owner_id = auth.uid()
    )
  );

create policy "owner_all_conversations" on public.conversations
  for all
  using (
    exists (
      select 1 from public.bots bo
      join public.businesses b on b.id = bo.business_id
      where bo.id = conversations.bot_id and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.bots bo
      join public.businesses b on b.id = bo.business_id
      where bo.id = conversations.bot_id and b.owner_id = auth.uid()
    )
  );

create policy "owner_all_messages" on public.messages
  for all
  using (
    exists (
      select 1 from public.conversations c
      join public.bots bo on bo.id = c.bot_id
      join public.businesses b on b.id = bo.business_id
      where c.id = messages.conversation_id and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.conversations c
      join public.bots bo on bo.id = c.bot_id
      join public.businesses b on b.id = bo.business_id
      where c.id = messages.conversation_id and b.owner_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "feat(db): add initial migration with tables and RLS policies"
```

---

## Task 10: README

**Files:**

- Modify: `README.md` (full replacement — `create-next-app` generates one)

- [ ] **Step 1: Replace `README.md`**

````markdown
# Botio

WhatsApp AI bots for businesses, powered by Claude.

This is sub-project 1 of 5 — the foundation scaffold. See `docs/superpowers/specs/2026-04-14-botio-foundation-design.md` for the full design.

## Stack

- Next.js 14 (App Router) + TypeScript (strict)
- Tailwind CSS — dark theme, neon green + electric blue gradients
- Supabase Cloud — Postgres + Auth + RLS
- `@supabase/ssr` for browser / server / middleware clients
- Geist Sans + Geist Mono via `next/font`
- Node 20, npm

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```
````

2. **Create a Supabase project**
   - Go to https://supabase.com/dashboard and create a new project.
   - From the project's API settings, copy:
     - Project URL
     - `anon` public key
     - `service_role` secret key

3. **Apply the database migration**
   - Open the Supabase SQL editor.
   - Paste the contents of `supabase/migrations/0001_init.sql` and run it.
   - Confirm the four tables (`businesses`, `bots`, `conversations`, `messages`) appear under the `public` schema with RLS enabled.

4. **Configure environment variables**

   ```bash
   cp .env.local.example .env.local
   ```

   Fill in the three values from step 2. `.env.local` is gitignored.

5. **Run the dev server**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000. You should see the branded placeholder page.

## Project layout

```
app/                  Next.js App Router
  layout.tsx          Root layout (fonts, dark theme)
  page.tsx            Placeholder landing
  globals.css         Tailwind base
components/           Shared UI
  logo.tsx            Inline SVG robot logo
lib/supabase/         Supabase client boundary
  client.ts           Browser client
  server.ts           Server component / route handler client
  middleware.ts       Middleware client helper
middleware.ts         Root middleware (no-op; wired up in sub-project 2)
supabase/migrations/  Versioned SQL migrations
docs/superpowers/     Specs and plans
```

## Scripts

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm run format` — Prettier write
- `npm run format:check` — Prettier check

## Roadmap

- **Sub-project 1 (this one):** scaffold + DB schema + branding base
- **Sub-project 2:** real landing + Google OAuth
- **Sub-project 3:** dashboard + onboarding wizard
- **Sub-project 4:** `/api/webhook/[botId]` (Twilio ↔ Claude)
- **Sub-project 5:** realtime conversations panel

## Known TODOs before production

- Encrypt `bots.twilio_auth_token` using `pgsodium` / Supabase Vault.

````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add setup README"
````

---

## Task 11: Final verification walk-through

**Files:** none

- [ ] **Step 1: Clean install smoke test**

Run:

```bash
rm -rf .next
npm run lint
npx tsc --noEmit
npm run build
```

Expected: all three commands succeed with zero errors and zero warnings.

- [ ] **Step 2: Dev server visual check**

Run: `npm run dev`
Open `http://localhost:3000`.
Verify:

- Background is near-black (`#0A0A0B`) with a subtle green glow at the top.
- Robot logo is centered, green neon (`#00FF88`).
- "Botio" wordmark is large, bold, green-to-blue gradient, readable.
- Tagline "WhatsApp AI for your business." is in muted gray below.
- Page is responsive down to 375px width (no horizontal scroll).

Stop with Ctrl+C.

- [ ] **Step 3: Prettier check**

Run: `npm run format:check`
Expected: all files formatted.

- [ ] **Step 4: Definition-of-Done checklist (from spec §9)**

Confirm each of these, checking them off in the spec itself if desired:

- [ ] `npm run dev` renders the placeholder with correct theme
- [ ] `npm run build` clean
- [ ] `npm run lint` clean
- [ ] `supabase/migrations/0001_init.sql` applied cleanly to a fresh Supabase project (manual — report back)
- [ ] The four tables exist with RLS enabled (visible in Supabase Table editor; each has a green "RLS enabled" badge)
- [ ] Manual smoke test: from the Supabase SQL editor, run `set role anon; select * from public.businesses;` — expect empty result (no rows visible without auth)
- [ ] `.env.local` is gitignored (`git check-ignore .env.local` prints a match)
- [ ] `.env.local.example` is committed

- [ ] **Step 5: Final commit if anything was touched by formatting**

```bash
git status
# If clean, done. If changes exist:
git add -A
git commit -m "chore: final formatting pass"
```

- [ ] **Step 6: Report back**

Report:

- Commit count and short log (`git log --oneline`)
- Any DoD items that could not be verified locally (Supabase migration application requires user action on their cloud project)
- Confirmation that `npm run build` and `npm run lint` are green

---

## Self-Review Summary

**Spec coverage check** (against `2026-04-14-botio-foundation-design.md`):

| Spec section          | Covered by                             |
| --------------------- | -------------------------------------- |
| §2 Stack decisions    | Tasks 1, 2, 4, 7                       |
| §3 Repository layout  | Tasks 1, 5, 7, 9, 10                   |
| §4.1 Tables           | Task 9                                 |
| §4.2 RLS              | Task 9                                 |
| §4.3 Schema notes     | Task 9 (inline SQL comments)           |
| §5.1 Tailwind tokens  | Task 3                                 |
| §5.2 Logo             | Task 5                                 |
| §5.3 Root layout      | Task 4                                 |
| §5.4 Placeholder page | Task 6                                 |
| §6 Supabase helpers   | Task 7                                 |
| §7 Env vars           | Task 8                                 |
| §8 README             | Task 10                                |
| §9 Definition of Done | Task 11                                |
| §10 Out of scope      | respected (no tasks violate it)        |
| §11 Known TODOs       | README §"Known TODOs" + schema comment |

**Placeholder scan:** none found. Every step has concrete code, commands, or explicit manual verification instructions.

**Type consistency:** `lib/supabase/client.ts`, `server.ts`, and `middleware.ts` each export a function named `createClient` — consumers disambiguate by import path. `components/logo.tsx` exports `Logo`, imported as `import { Logo } from '@/components/logo'` in `app/page.tsx`. Env var names match between `.env.local.example`, the three Supabase helpers, and the README.
