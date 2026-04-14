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

## Temporary admin bypass

Real auth is coming in a later sub-project. Until then, `/admin` is protected by a single password stored in `ADMIN_PASSWORD`.

1. Set `ADMIN_PASSWORD` in `.env.local` to any value you choose.
2. Visit `http://localhost:3000/admin` and enter the password.
3. From there you can list businesses, list bots, and create a new bot (which also creates its business in one step).

The login sets an httpOnly cookie valid for 7 days. Use the "Log out" button to clear it.

## Webhook — `/api/webhook/[botId]`

Each bot has its own Twilio WhatsApp webhook URL:

```
https://<your-host>/api/webhook/<bot-id>
```

Point the Twilio WhatsApp sandbox (or your production WhatsApp sender) at that URL. The route:

1. Receives the incoming message from Twilio (form-encoded POST).
2. Loads the bot's `system_prompt` and Twilio credentials from Supabase.
3. Calls `claude-haiku-4-5-20251001` with the system prompt (prompt-cached) and the last 20 messages of history.
4. Persists both the incoming user message and the assistant reply to the `messages` table.
5. Sends the reply back via the Twilio REST API using the per-bot credentials.
6. Responds with empty TwiML.

Required env vars: `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, plus Twilio creds on the bot row.

**Security TODOs before production:**

- Validate `X-Twilio-Signature` on incoming requests.
- Rate-limit the admin login.
- Encrypt `bots.twilio_auth_token` (already in the sub-project 1 TODO list).
- Replace the admin bypass with real auth.

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
