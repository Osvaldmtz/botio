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

## Meta webhook — `/api/webhook/meta/[botId]`

Receives inbound Messenger and Instagram DMs for a bot and replies via the Meta Graph API. The same `bots` table row supplies the system prompt, and messages are persisted into the same `conversations`/`messages` tables used by the Twilio webhook — `customer_phone` is namespaced as `messenger:<psid>` or `instagram:<psid>` so the two channels cannot collide.

**Env vars:**

- `META_VERIFY_TOKEN` — a random string you pick. Meta echoes it during the webhook subscribe handshake.
- `META_PAGE_ACCESS_TOKEN` — the Page access token used to send outbound messages via the Graph API (needs `pages_messaging` and, for Instagram, `instagram_basic` + `pages_show_list` scopes).

**Endpoints:**

- `GET /api/webhook/meta/<bot-id>` — verification handshake. Meta hits this once when you subscribe the webhook. Validates `hub.verify_token` against `META_VERIFY_TOKEN` and echoes `hub.challenge` back as plain text. Returns `403` on mismatch, `500` if the token is unset.
- `POST /api/webhook/meta/<bot-id>` — receives messages. Parses the JSON payload, skips echoes (`message.is_echo`), delivery/read receipts, and any event without text. For each surviving event: upserts the conversation, persists the user message, calls `claude-haiku-4-5-20251001` with the bot's system prompt and the last 20 messages, persists the assistant reply, then sends it via `POST https://graph.facebook.com/v19.0/me/messages`. Always responds `200 { received: true }` to prevent Meta retry storms; internal errors are logged but do not fail the request.

**Limitations / TODOs:**

- **No `X-Hub-Signature-256` validation** yet — the POST route trusts any caller with valid JSON. Add HMAC verification against the Meta app secret before production.
- **No tool use on Meta channel.** The Kalyo `activate_pro_trial` and `notify_sales_team` tools are currently wired only inside the Twilio route. Messenger users hitting the Kalyo bot get conversational replies but cannot self-activate trials. Extract `buildClaudeOptions` to a shared module when tool parity across channels is needed.
- **Single-page mode.** `META_PAGE_ACCESS_TOKEN` is a single global env var; multi-tenant Meta setups would need to move the token onto the `bots` table with its own migration.

## Kalyo Pro-trial integration

One specific bot (identified by `KALYO_BOT_ID`) has an extra tool exposed to Claude: `activate_pro_trial`. When a user writes to that bot asking to start their free Pro trial and provides their email, Claude calls the tool, which looks up the email in the Kalyo Supabase project and upgrades the matching `psychologists` row to Pro for 15 days (`plan = 'professional'`, `trial_ends_at` and `plan_expires_at` set to now + 15d).

**Env vars (required to enable the tools):**

- `KALYO_SUPABASE_URL` — e.g. `https://<project-ref>.supabase.co`
- `KALYO_SUPABASE_SERVICE_KEY` — Kalyo project service role key
- `KALYO_BOT_ID` — the Botio bot UUID that should expose the tools
- `KALYO_SALES_PHONE` — WhatsApp destination for the `notify_sales_team` tool (e.g. `+528114112000` or `whatsapp:+528114112000`)

If the first three are missing, neither tool is exposed and the Kalyo bot behaves like any other bot. If `KALYO_SALES_PHONE` is missing, `notify_sales_team` returns an error status and Claude apologizes to the user.

The Kalyo bot currently exposes two tools: `activate_pro_trial` (below) and `notify_sales_team`, which sends a formatted lead notification to `KALYO_SALES_PHONE` via the Kalyo bot's own Twilio credentials. Claude calls `notify_sales_team` when the user asks to speak with a human or when they share contact info that should be followed up on. At least a name OR a phone is required; other fields (email, preferred time, reason) are optional.

**Tool outcomes:**

- `success` — row updated; Claude confirms the trial is active for 15 days.
- `already_active` — psychologist is already on `plan = 'professional'` with an expiration date beyond the new 15-day window. The tool does NOT overwrite, so a real paid subscription cannot be accidentally shortened.
- `already_used` — psychologist had a trial in the past (`trial_ends_at` is before now) and is no longer on `professional`. One trial per account; Claude replies with a fixed Spanish message pointing to https://kalyo.io for a paid subscription.
- `not_found` — email not in `psychologists`. Claude tells the user to register at https://kalyo.io first, then send their email again.
- `error` — tool call failed (invalid email, DB error, missing env vars). Claude apologizes and asks the user to retry.

**Security TODO:** today there is no verification that the WhatsApp sender actually owns the email they provide. Anyone who knows a psychologist's email could activate their trial. Acceptable for low-traffic beta; add an email ownership check (one-time code) before production.

## Trial follow-up cron — `/api/cron/trial-followup`

Daily cron that nudges Kalyo psychologists whose Pro trial is ending, so they convert to paid. Configured in `vercel.json` to fire at 14:00 UTC (~08:00 CDMX).

The route:

1. Validates the `Authorization: Bearer <CRON_SECRET>` header (Vercel cron sends this automatically when `CRON_SECRET` is set as an env var in the project).
2. Loads the Kalyo bot's Twilio credentials from Botio's own `bots` table (keyed by `KALYO_BOT_ID`).
3. Queries Kalyo's `psychologists` for rows where `plan = 'professional'`, `phone is not null`, and `trial_ends_at` falls within the target UTC day:
   - **3 days out** → "Hola! Tu prueba Pro de Kalyo termina en 3 días…"
   - **Today** → "Tu prueba gratuita de Kalyo Pro termina hoy…"
4. Sends each reminder via Twilio REST using the Kalyo bot's stored credentials.
5. Returns a JSON summary: `{ three_day: { found, sent, failed }, today: { found, sent, failed } }`.

**Env var added:** `CRON_SECRET` (required — route returns 500 if unset).

**Manual invocation (for testing):**

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-host>/api/cron/trial-followup
```

**Known limitations:**

- Day matching uses UTC. Psychologists near a UTC day boundary may get a reminder a few hours earlier or later than their local day edge.
- Phones are lightly normalized (`+` prefix added if missing) before being prefixed with `whatsapp:`. Severely malformed numbers will fail at Twilio and be logged; the batch continues.
- A user who subscribes to a paid plan but still has their original `trial_ends_at` set may receive one final reminder if that date matches today or 3 days from now.

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
