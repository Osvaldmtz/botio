# Kalyo Pro-Trial Activation via Claude Tool Use

> **For agentic workers:** this plan will be executed in-session by the controller, not by subagent dispatch. The Claude tool-use loop is error-prone and benefits from tight feedback; subagent delegation would add round-trips.

**Goal:** When the Kalyo WhatsApp bot receives a message from a psychologist asking to activate their free Pro trial, Claude should call a tool that looks up the email in the Kalyo Supabase project (separate from Botio's own) and upgrades their `psychologists` row to Pro for 15 days. The tool is only wired up for the Kalyo bot — all other bots continue to behave exactly as before.

**Why tool use and not regex:** natural conversation ("oye soy maria@x.com y quiero probar pro por favor") is hard to handle with keyword matching, especially across languages. Claude Haiku decides when to call the tool from context, which keeps the admin's system prompt free of brittle parsing logic.

**Spec decisions (confirmed with user):**

- **Security:** no identity verification between WhatsApp number and email — accepted as TODO for low-traffic beta.
- **Gating:** single env var `KALYO_BOT_ID`; the tool is only exposed to Claude when `bot.id === process.env.KALYO_BOT_ID`.
- **Intent detection:** Claude tool use (not regex).
- **Kalyo schema (confirmed):** table `psychologists`, key fields `email` (unique text), `auth_id` (uuid). Upgrade mutates `plan` (enum → `'pro'`), `trial_ends_at` (timestamptz → now + 15d), `plan_expires_at` (timestamptz → now + 15d).
- **Paying-customer safety:** if the psychologist is already on `plan = 'pro'` with `plan_expires_at` further in the future than 15 days from now, return `already_active` and do NOT overwrite — prevents the trial flow from shortening a real paid subscription.

**Dependencies:** no new npm packages. `@supabase/supabase-js` and `@anthropic-ai/sdk` are already installed.

---

## File changes

- `.env.local.example` — add `KALYO_SUPABASE_URL`, `KALYO_SUPABASE_SERVICE_KEY`, `KALYO_BOT_ID`
- `lib/kalyo.ts` — NEW: Kalyo service-role Supabase client + `activateProTrial(email)` function with paying-customer safety
- `lib/claude.ts` — MODIFIED: `generateReply` gains an optional `{ tools, toolHandlers }` options argument and runs a tool-use loop (up to 5 iterations) when tools are provided; current callers stay backward-compatible
- `app/api/webhook/[botId]/route.ts` — MODIFIED: when `bot.id === KALYO_BOT_ID`, append Kalyo-specific instructions to the system prompt, expose the `activate_pro_trial` tool, and pass a handler that invokes `activateProTrial`
- `README.md` — document the three new env vars and the trial activation behavior

---

## Task 1: Env vars

Append to `.env.local.example`:

```
# Kalyo — activate-pro-trial tool target (separate Supabase project)
KALYO_SUPABASE_URL=
KALYO_SUPABASE_SERVICE_KEY=
KALYO_BOT_ID=
```

Commit: `chore: add Kalyo pro-trial env vars`

---

## Task 2: `lib/kalyo.ts`

New module exporting:

```ts
export type ActivateProTrialResult =
  | { status: 'success'; expires_at: string }
  | { status: 'already_active'; expires_at: string }
  | { status: 'not_found' }
  | { status: 'error'; message: string };

export async function activateProTrial(email: string): Promise<ActivateProTrialResult>
```

Behavior:

1. Trim + lowercase the email. If it doesn't contain `@`, return `error`.
2. Lazy-construct a service-role Supabase client using `KALYO_SUPABASE_URL` + `KALYO_SUPABASE_SERVICE_KEY` (`persistSession: false`, `autoRefreshToken: false`).
3. `select id, email, plan, plan_expires_at from psychologists where email = <normalized>` (maybeSingle).
4. If not found → `{ status: 'not_found' }`.
5. Compute `expiresAt = now() + 15 days`.
6. If `plan === 'pro'` AND `new Date(plan_expires_at) > expiresAt` → `{ status: 'already_active', expires_at: <current> }` without updating.
7. Otherwise update `plan = 'pro'`, `trial_ends_at = expiresAt`, `plan_expires_at = expiresAt`. On success return `{ status: 'success', expires_at }`.
8. Any Supabase error → log via `console.error('[kalyo] ...')` and return `{ status: 'error', message: err.message }`.

Must import `'server-only'` at the top.

Commit: `feat(kalyo): add activateProTrial with paying-customer safety`

---

## Task 3: Tool-use loop in `lib/claude.ts`

Extend `generateReply` to accept optional tools. Keep the existing signature working (second arg stays `ChatMessage[]`, new options are a third arg with default `{}`).

```ts
import type Anthropic from '@anthropic-ai/sdk';

export type ToolHandler = (input: unknown) => Promise<unknown>;

export type GenerateReplyOptions = {
  tools?: Anthropic.Messages.Tool[];
  toolHandlers?: Record<string, ToolHandler>;
};

export async function generateReply(
  systemPrompt: string,
  history: ChatMessage[],
  options: GenerateReplyOptions = {},
): Promise<string>
```

Loop algorithm (max 5 iterations to avoid runaway tool calls):

1. Seed `messages: MessageParam[]` from `history` (text-only, as today).
2. Each iteration, call `client.messages.create` with `system`, `messages`, and `tools` (only when non-empty). System prompt keeps `cache_control: { type: 'ephemeral' }`.
3. If `response.stop_reason !== 'tool_use'` → find the first `type: 'text'` content block, return its text (or a "Sorry, I could not generate a response." fallback).
4. Otherwise:
   a. Push `{ role: 'assistant', content: response.content }` onto `messages` (verbatim — Claude requires the full assistant turn including tool_use blocks to be echoed back).
   b. For each `tool_use` block, call the matching handler from `toolHandlers`. Wrap in try/catch — if the handler throws or the tool name is unknown, emit a `tool_result` with `is_error: true` and a short message. Otherwise JSON-stringify the handler's return value as the `content` of the `tool_result`.
   c. Push `{ role: 'user', content: toolResults }` onto `messages`.
5. After 5 iterations with no final text → return `"Sorry, I got stuck. Please try again."`.

No changes to existing text-only call sites — the `options` arg is optional and defaults to no tools, so behavior is unchanged for non-Kalyo bots.

Commit: `feat(claude): support Anthropic tool use with handler loop`

---

## Task 4: Webhook wiring

In `app/api/webhook/[botId]/route.ts`:

- Import `activateProTrial` from `@/lib/kalyo` and the `Tool` type from `@anthropic-ai/sdk`.
- Add two top-level constants:
  - `KALYO_TRIAL_INSTRUCTIONS` — short natural-language policy appended to the bot's stored system prompt when the Kalyo tool is active. Tells Claude when to call the tool, how to phrase each outcome (`success`, `not_found`, `already_active`, `error`), and to always reply in the user's language.
  - `KALYO_TOOL` — the `activate_pro_trial` tool definition with an `email: string` required input.
- In the POST handler, after loading the bot:

  ```ts
  const kalyoBotId = process.env.KALYO_BOT_ID;
  const isKalyoBot = Boolean(kalyoBotId) && bot.id === kalyoBotId;

  const systemPrompt =
    (bot.system_prompt ?? '') + (isKalyoBot ? KALYO_TRIAL_INSTRUCTIONS : '');

  const claudeOptions = isKalyoBot
    ? {
        tools: [KALYO_TOOL],
        toolHandlers: {
          activate_pro_trial: async (input: unknown) => {
            const email =
              typeof input === 'object' && input !== null && 'email' in input
                ? String((input as { email: unknown }).email ?? '')
                : '';
            return activateProTrial(email);
          },
        },
      }
    : {};

  replyText = await generateReply(systemPrompt, history, claudeOptions);
  ```

- Everything else in the route (conversation upsert, message persistence, Twilio send, empty TwiML) stays identical.

Commit: `feat(webhook): wire Kalyo activate_pro_trial tool for KALYO_BOT_ID`

---

## Task 5: README

Append a new section after the Webhook section:

```markdown
## Kalyo Pro-trial integration

One specific bot (identified by `KALYO_BOT_ID`) has an extra tool exposed to Claude: `activate_pro_trial`. When a user writes to that bot asking to start their free Pro trial and provides their email, Claude calls the tool, which looks up the email in the Kalyo Supabase project (`KALYO_SUPABASE_URL` + `KALYO_SUPABASE_SERVICE_KEY`) and upgrades the matching `psychologists` row to 15-day Pro.

**Env vars (all three required to enable the tool):**

- `KALYO_SUPABASE_URL` — e.g. `https://<project-ref>.supabase.co`
- `KALYO_SUPABASE_SERVICE_KEY` — Kalyo project service role key
- `KALYO_BOT_ID` — the Botio bot UUID that should expose the tool

**Safety:**

- If the psychologist is already on `plan = 'pro'` with a later `plan_expires_at` than the new 15-day window, the tool returns `already_active` and does NOT overwrite — so a real paid subscription cannot be accidentally shortened by the trial flow.
- No verification today that the WhatsApp sender actually owns the email they provide. Acceptable for beta; flagged as TODO below.

**TODO before production:**

- Require email ownership proof (e.g., one-time code echoed back) before activating a trial.
```

Commit: `docs: document Kalyo pro-trial integration`

---

## Task 6: Verify + final commit

```bash
npx tsc --noEmit
npm run lint
npm run format
npm run build
```

Expected: all clean; build output unchanged except `/api/webhook/[botId]` bundle size may tick up. No new routes.

---

## Self-review

**Requirement coverage:**

| Requirement | File |
| --- | --- |
| Detect email + intent from natural conversation | Claude tool use via `KALYO_TOOL` |
| Query Kalyo Supabase for user by email | `lib/kalyo.ts` → `psychologists.select` |
| Upgrade `plan`, `trial_ends_at`, `plan_expires_at` to 15 days | `lib/kalyo.ts` → `psychologists.update` |
| Not-found path tells user to register at kalyo.io first | `KALYO_TRIAL_INSTRUCTIONS` in route.ts |
| Confirm activation via WhatsApp | Existing Twilio send path, unchanged |
| New env vars `KALYO_SUPABASE_URL`, `KALYO_SUPABASE_SERVICE_KEY` | Task 1 |
| Gating by `KALYO_BOT_ID` | Task 4 |

**Security TODOs carried forward:** no email ownership verification (user accepted), plaintext Twilio token (from sub-project 1).

**Backward compatibility:** `generateReply` gains an optional third argument; all existing callers (none outside the webhook today) keep the same behavior. Non-Kalyo bots see no change — the tools array is only passed when `isKalyoBot` is true.
