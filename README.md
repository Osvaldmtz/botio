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
