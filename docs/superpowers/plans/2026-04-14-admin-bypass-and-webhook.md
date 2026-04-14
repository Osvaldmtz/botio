# Admin Bypass + Twilio/Claude Webhook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan.

**Goal:** Ship a temporary password-gated admin dashboard (list businesses/bots, create bot) plus the Twilio↔Claude webhook (`/api/webhook/[botId]`) so the product is end-to-end usable before real auth is built.

**Architecture:** Both features bypass Supabase Auth by using a service-role Supabase client (`lib/supabase/admin.ts`) marked `server-only`. Admin protection is a plaintext httpOnly cookie compared to `ADMIN_PASSWORD`. The webhook receives Twilio form-encoded POSTs, generates a reply with `claude-haiku-4-5-20251001` (with prompt caching on the system prompt), and sends the response via Twilio REST using the per-bot creds stored in the DB.

**Tech Stack:** Next.js 14 App Router, Server Actions, `@supabase/supabase-js` with service role, `@anthropic-ai/sdk` (prompt caching), Twilio REST via `fetch`, `server-only` import guard. No tests in this iteration.

**Spec:** defined inline in `docs/superpowers/plans/2026-04-14-admin-bypass-and-webhook.md` (this file). Existing schema lives in `supabase/migrations/0001_init.sql`.

**Prior work:** Sub-project 1 foundation scaffold is complete at commit `85c2323`. 11 commits on `main`.

---

## File Structure

**Created:**

- `supabase/migrations/0002_admin_bypass.sql`
- `lib/supabase/admin.ts`
- `lib/admin-auth.ts`
- `lib/claude.ts`
- `lib/twilio.ts`
- `app/admin/page.tsx`
- `app/admin/actions.ts`
- `components/admin/login-form.tsx`
- `components/admin/dashboard.tsx`
- `app/api/webhook/[botId]/route.ts`

**Modified:**

- `.env.local.example` — add `ADMIN_PASSWORD`, `ANTHROPIC_API_KEY`
- `README.md` — document admin login and webhook setup
- `package.json` — add `@anthropic-ai/sdk`, `server-only`

---

## Task 1: Install dependencies and add env vars

**Files:**

- Modify: `package.json`, `.env.local.example`

- [ ] **Step 1: Install new dependencies**

```bash
npm install @anthropic-ai/sdk server-only
```

- [ ] **Step 2: Replace `.env.local.example`**

```
# Supabase — get from https://supabase.com/dashboard/project/_/settings/api
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Server-only. Never expose to the browser.
SUPABASE_SERVICE_ROLE_KEY=

# Temporary admin bypass — protects /admin until real auth ships
ADMIN_PASSWORD=

# Anthropic — used by the /api/webhook/[botId] route
ANTHROPIC_API_KEY=
```

- [ ] **Step 3: Verify lint and type-check**

```bash
npm run lint && npx tsc --noEmit
```

Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: add Anthropic SDK and admin/claude env vars"
```

---

## Task 2: Schema migration — make businesses.owner_id nullable

**Files:**

- Create: `supabase/migrations/0002_admin_bypass.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Temporary: allow admin-created businesses without a real auth user.
-- The RLS policy still requires owner_id = auth.uid() for read/write by
-- authenticated users. Rows created by the admin bypass have owner_id = NULL
-- and are only accessible via the service-role key. Revisit when real auth ships.

alter table public.businesses
  alter column owner_id drop not null;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0002_admin_bypass.sql
git commit -m "feat(db): allow null owner_id on businesses for temporary admin bypass"
```

Note: the user applies this migration manually in the Supabase SQL editor. Do not try to run it anywhere.

---

## Task 3: Service-role Supabase client

**Files:**

- Create: `lib/supabase/admin.ts`

- [ ] **Step 1: Create `lib/supabase/admin.ts`**

```ts
import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Service-role client. Bypasses RLS. Must NEVER be imported from client code —
// the `server-only` import above fails the build if it leaks to a client bundle.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/admin.ts
git commit -m "feat(supabase): add service-role admin client (server-only)"
```

---

## Task 4: Admin auth cookie helpers

**Files:**

- Create: `lib/admin-auth.ts`

- [ ] **Step 1: Create `lib/admin-auth.ts`**

```ts
import 'server-only';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'botio_admin';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function isAdmin(): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const value = cookies().get(COOKIE_NAME)?.value;
  return value === expected;
}

export function setAdminCookie(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || password !== expected) return false;
  cookies().set({
    name: COOKIE_NAME,
    value: password,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
  return true;
}

export function clearAdminCookie() {
  cookies().set({
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/admin-auth.ts
git commit -m "feat(auth): add temporary admin cookie helpers"
```

---

## Task 5: Admin server actions

**Files:**

- Create: `app/admin/actions.ts`

- [ ] **Step 1: Create `app/admin/actions.ts`**

```ts
'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdmin, setAdminCookie, clearAdminCookie } from '@/lib/admin-auth';

export async function loginAction(formData: FormData) {
  const password = String(formData.get('password') ?? '');
  const ok = setAdminCookie(password);
  if (!ok) {
    return { error: 'Invalid password' };
  }
  redirect('/admin');
}

export async function logoutAction() {
  clearAdminCookie();
  redirect('/admin');
}

export async function createBotAction(formData: FormData) {
  if (!isAdmin()) {
    return { error: 'Unauthorized' };
  }

  const businessName = String(formData.get('business_name') ?? '').trim();
  const botName = String(formData.get('bot_name') ?? '').trim();
  const systemPrompt = String(formData.get('system_prompt') ?? '').trim();
  const twilioAccountSid = String(formData.get('twilio_account_sid') ?? '').trim();
  const twilioAuthToken = String(formData.get('twilio_auth_token') ?? '').trim();
  const twilioWhatsappNumber = String(
    formData.get('twilio_whatsapp_number') ?? '',
  ).trim();

  if (!businessName || !botName) {
    return { error: 'Business name and bot name are required' };
  }

  const supabase = createAdminClient();

  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .insert({ name: businessName, owner_id: null })
    .select('id')
    .single();

  if (businessError || !business) {
    return { error: `Failed to create business: ${businessError?.message}` };
  }

  const { error: botError } = await supabase.from('bots').insert({
    business_id: business.id,
    name: botName,
    system_prompt: systemPrompt,
    twilio_account_sid: twilioAccountSid || null,
    twilio_auth_token: twilioAuthToken || null,
    twilio_whatsapp_number: twilioWhatsappNumber || null,
    is_active: true,
  });

  if (botError) {
    return { error: `Failed to create bot: ${botError.message}` };
  }

  revalidatePath('/admin');
  return { success: true };
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/admin/actions.ts
git commit -m "feat(admin): add server actions for login, logout, and create-bot"
```

---

## Task 6: Admin UI components

**Files:**

- Create: `components/admin/login-form.tsx`
- Create: `components/admin/dashboard.tsx`

- [ ] **Step 1: Create `components/admin/login-form.tsx`**

```tsx
import { loginAction } from '@/app/admin/actions';

export function LoginForm() {
  return (
    <main className="bg-gradient-glow flex min-h-screen items-center justify-center px-6">
      <form
        action={loginAction}
        className="bg-bg-elevated border-bg-border w-full max-w-sm space-y-4 rounded-xl border p-8"
      >
        <h1 className="text-fg text-2xl font-semibold">Admin</h1>
        <p className="text-fg-muted text-sm">
          Temporary password-protected area. Real auth coming soon.
        </p>
        <label className="block space-y-1">
          <span className="text-fg-muted text-xs uppercase tracking-wide">
            Password
          </span>
          <input
            type="password"
            name="password"
            required
            autoFocus
            className="bg-bg border-bg-border text-fg focus:border-accent w-full rounded-md border px-3 py-2 outline-none"
          />
        </label>
        <button
          type="submit"
          className="bg-accent text-bg hover:bg-accent-hover w-full rounded-md px-3 py-2 font-semibold transition-colors"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Create `components/admin/dashboard.tsx`**

```tsx
import { createBotAction, logoutAction } from '@/app/admin/actions';

type Business = {
  id: string;
  name: string;
  created_at: string;
};

type Bot = {
  id: string;
  name: string;
  business_id: string;
  is_active: boolean;
  twilio_whatsapp_number: string | null;
  created_at: string;
};

type DashboardProps = {
  businesses: Business[];
  bots: Bot[];
};

export function Dashboard({ businesses, bots }: DashboardProps) {
  const businessById = new Map(businesses.map((b) => [b.id, b]));

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-fg text-3xl font-bold">Admin dashboard</h1>
          <p className="text-fg-muted text-sm">Temporary bypass mode.</p>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="border-bg-border text-fg-muted hover:text-fg rounded-md border px-3 py-2 text-sm"
          >
            Log out
          </button>
        </form>
      </header>

      <section className="mb-10">
        <h2 className="text-fg mb-4 text-xl font-semibold">
          Businesses ({businesses.length})
        </h2>
        {businesses.length === 0 ? (
          <p className="text-fg-muted text-sm">No businesses yet.</p>
        ) : (
          <ul className="border-bg-border divide-bg-border bg-bg-elevated divide-y rounded-lg border">
            {businesses.map((b) => (
              <li key={b.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-fg">{b.name}</span>
                <code className="text-fg-muted text-xs">{b.id}</code>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-10">
        <h2 className="text-fg mb-4 text-xl font-semibold">Bots ({bots.length})</h2>
        {bots.length === 0 ? (
          <p className="text-fg-muted text-sm">No bots yet.</p>
        ) : (
          <ul className="border-bg-border divide-bg-border bg-bg-elevated divide-y rounded-lg border">
            {bots.map((bot) => {
              const business = businessById.get(bot.business_id);
              return (
                <li key={bot.id} className="flex flex-col gap-1 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-fg font-medium">{bot.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        bot.is_active
                          ? 'bg-accent/20 text-accent'
                          : 'bg-bg-border text-fg-muted'
                      }`}
                    >
                      {bot.is_active ? 'active' : 'inactive'}
                    </span>
                  </div>
                  <div className="text-fg-muted flex flex-wrap gap-x-4 text-xs">
                    <span>Business: {business?.name ?? '—'}</span>
                    <span>WhatsApp: {bot.twilio_whatsapp_number ?? '—'}</span>
                    <code>webhook: /api/webhook/{bot.id}</code>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-fg mb-4 text-xl font-semibold">Create a new bot</h2>
        <form
          action={createBotAction}
          className="bg-bg-elevated border-bg-border grid gap-4 rounded-lg border p-6"
        >
          <Field label="Business name" name="business_name" required />
          <Field label="Bot name" name="bot_name" required />
          <Field
            label="System prompt"
            name="system_prompt"
            textarea
            placeholder="You are a helpful assistant for..."
          />
          <Field label="Twilio Account SID" name="twilio_account_sid" />
          <Field
            label="Twilio Auth Token"
            name="twilio_auth_token"
            type="password"
          />
          <Field
            label="Twilio WhatsApp number"
            name="twilio_whatsapp_number"
            placeholder="whatsapp:+1234567890"
          />
          <button
            type="submit"
            className="bg-accent text-bg hover:bg-accent-hover justify-self-start rounded-md px-4 py-2 font-semibold"
          >
            Create bot
          </button>
        </form>
      </section>
    </main>
  );
}

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  textarea?: boolean;
};

function Field({
  label,
  name,
  type = 'text',
  required,
  placeholder,
  textarea,
}: FieldProps) {
  const classes =
    'bg-bg border-bg-border text-fg focus:border-accent w-full rounded-md border px-3 py-2 outline-none';
  return (
    <label className="block space-y-1">
      <span className="text-fg-muted text-xs uppercase tracking-wide">
        {label}
      </span>
      {textarea ? (
        <textarea
          name={name}
          required={required}
          placeholder={placeholder}
          rows={4}
          className={classes}
        />
      ) : (
        <input
          type={type}
          name={name}
          required={required}
          placeholder={placeholder}
          className={classes}
        />
      )}
    </label>
  );
}
```

- [ ] **Step 3: Type-check and lint**

```bash
npx tsc --noEmit && npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add components/admin
git commit -m "feat(admin): add login form and dashboard components"
```

---

## Task 7: Admin page wiring

**Files:**

- Create: `app/admin/page.tsx`

- [ ] **Step 1: Create `app/admin/page.tsx`**

```tsx
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdmin } from '@/lib/admin-auth';
import { LoginForm } from '@/components/admin/login-form';
import { Dashboard } from '@/components/admin/dashboard';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  if (!isAdmin()) {
    return <LoginForm />;
  }

  const supabase = createAdminClient();

  const [businessesResult, botsResult] = await Promise.all([
    supabase
      .from('businesses')
      .select('id, name, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('bots')
      .select('id, name, business_id, is_active, twilio_whatsapp_number, created_at')
      .order('created_at', { ascending: false }),
  ]);

  if (businessesResult.error || botsResult.error) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-fg text-2xl font-bold">Admin dashboard</h1>
        <p className="mt-4 text-red-400">
          Failed to load data:{' '}
          {businessesResult.error?.message ?? botsResult.error?.message}
        </p>
      </main>
    );
  }

  return (
    <Dashboard
      businesses={businessesResult.data ?? []}
      bots={botsResult.data ?? []}
    />
  );
}
```

- [ ] **Step 2: Type-check, lint, build**

```bash
npx tsc --noEmit && npm run lint && npm run build
```

Expected: all clean. Build should show `/admin` as a dynamic route.

- [ ] **Step 3: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat(admin): add password-gated /admin page with business + bot lists"
```

---

## Task 8: Claude helper

**Files:**

- Create: `lib/claude.ts`

- [ ] **Step 1: Create `lib/claude.ts`**

```ts
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 1024;

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ANTHROPIC_API_KEY');
  }
  client = new Anthropic({ apiKey });
  return client;
}

export async function generateReply(
  systemPrompt: string,
  history: ChatMessage[],
): Promise<string> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      {
        type: 'text',
        text: systemPrompt || 'You are a helpful assistant.',
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: history.map((m) => ({ role: m.role, content: m.content })),
  });

  const firstTextBlock = response.content.find((block) => block.type === 'text');
  if (!firstTextBlock || firstTextBlock.type !== 'text') {
    return 'Sorry, I could not generate a response.';
  }
  return firstTextBlock.text;
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/claude.ts
git commit -m "feat(claude): add generateReply helper with prompt caching on system prompt"
```

---

## Task 9: Twilio helper

**Files:**

- Create: `lib/twilio.ts`

- [ ] **Step 1: Create `lib/twilio.ts`**

```ts
import 'server-only';

type SendWhatsAppArgs = {
  accountSid: string;
  authToken: string;
  from: string; // e.g. "whatsapp:+14155238886"
  to: string; // e.g. "whatsapp:+521..."
  body: string;
};

export async function sendWhatsApp({
  accountSid,
  authToken,
  from,
  to,
  body,
}: SendWhatsAppArgs): Promise<void> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const form = new URLSearchParams();
  form.set('From', from);
  form.set('To', to);
  form.set('Body', body);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Twilio send failed: ${response.status} ${text}`);
  }
}

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response/>';

export function emptyTwimlResponse(): Response {
  return new Response(EMPTY_TWIML, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/twilio.ts
git commit -m "feat(twilio): add sendWhatsApp helper via REST + empty TwiML response"
```

---

## Task 10: Webhook route

**Files:**

- Create: `app/api/webhook/[botId]/route.ts`

- [ ] **Step 1: Create `app/api/webhook/[botId]/route.ts`**

```ts
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateReply, type ChatMessage } from '@/lib/claude';
import { sendWhatsApp, emptyTwimlResponse } from '@/lib/twilio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HISTORY_LIMIT = 20;
const FALLBACK_MESSAGE = "Sorry, I'm having trouble right now. Please try again in a moment.";

type Params = { params: { botId: string } };

export async function POST(request: Request, { params }: Params) {
  const { botId } = params;

  let from: string;
  let messageBody: string;
  try {
    const form = await request.formData();
    from = String(form.get('From') ?? '');
    messageBody = String(form.get('Body') ?? '');
    if (!from || !messageBody) {
      return new Response('Missing From or Body', { status: 400 });
    }
  } catch {
    return new Response('Invalid form body', { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: bot, error: botError } = await supabase
    .from('bots')
    .select(
      'id, system_prompt, twilio_account_sid, twilio_auth_token, twilio_whatsapp_number, is_active',
    )
    .eq('id', botId)
    .maybeSingle();

  if (botError || !bot) {
    return new Response('Bot not found', { status: 404 });
  }
  if (!bot.is_active) {
    return new Response('Bot inactive', { status: 403 });
  }

  // Upsert conversation on (bot_id, customer_phone) unique constraint.
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .upsert(
      { bot_id: bot.id, customer_phone: from },
      { onConflict: 'bot_id,customer_phone' },
    )
    .select('id')
    .single();

  if (convError || !conversation) {
    console.error('[webhook] failed to upsert conversation', convError);
    return new Response('Internal error', { status: 500 });
  }

  // Persist the incoming user message.
  const { error: userMsgError } = await supabase.from('messages').insert({
    conversation_id: conversation.id,
    role: 'user',
    content: messageBody,
  });
  if (userMsgError) {
    console.error('[webhook] failed to insert user message', userMsgError);
    return new Response('Internal error', { status: 500 });
  }

  // Load recent history (oldest → newest), including the message we just wrote.
  const { data: historyRows, error: historyError } = await supabase
    .from('messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);

  if (historyError) {
    console.error('[webhook] failed to load history', historyError);
    return new Response('Internal error', { status: 500 });
  }

  const history: ChatMessage[] = (historyRows ?? [])
    .slice()
    .reverse()
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

  // Generate the assistant reply.
  let replyText: string;
  try {
    replyText = await generateReply(bot.system_prompt ?? '', history);
  } catch (error) {
    console.error('[webhook] Claude call failed', error);
    replyText = FALLBACK_MESSAGE;
  }

  // Persist the assistant reply (best effort — don't abort on failure).
  const { error: assistantMsgError } = await supabase.from('messages').insert({
    conversation_id: conversation.id,
    role: 'assistant',
    content: replyText,
  });
  if (assistantMsgError) {
    console.error('[webhook] failed to insert assistant message', assistantMsgError);
  }

  // Send the reply via Twilio REST using the bot's stored credentials.
  if (
    bot.twilio_account_sid &&
    bot.twilio_auth_token &&
    bot.twilio_whatsapp_number
  ) {
    try {
      await sendWhatsApp({
        accountSid: bot.twilio_account_sid,
        authToken: bot.twilio_auth_token,
        from: bot.twilio_whatsapp_number,
        to: from,
        body: replyText,
      });
    } catch (error) {
      console.error('[webhook] Twilio send failed', error);
    }
  } else {
    console.warn('[webhook] bot missing Twilio credentials — skipping outbound send');
  }

  return emptyTwimlResponse();
}
```

- [ ] **Step 2: Type-check, lint, build**

```bash
npx tsc --noEmit && npm run lint && npm run build
```

Expected: build shows the new dynamic route `/api/webhook/[botId]`.

- [ ] **Step 3: Commit**

```bash
git add app/api/webhook
git commit -m "feat(webhook): implement Twilio WhatsApp webhook with Claude Haiku"
```

---

## Task 11: README update

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Add these sections to the README**

Append after the existing "Setup" section, before "Project layout":

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document admin bypass and webhook endpoint"
```

---

## Task 12: Final verification

**Files:** none

- [ ] **Step 1: Full clean build gate**

```bash
rm -rf .next
npm run lint
npx tsc --noEmit
npm run build
npm run format:check
```

All four must be clean. If `format:check` fails, run `npm run format`, commit `chore: final formatting pass`, and re-run.

- [ ] **Step 2: Route sanity check**

In `npm run build` output, confirm these routes appear:

- `/admin` (dynamic, server-rendered)
- `/api/webhook/[botId]` (dynamic, route handler)

- [ ] **Step 3: Dev server smoke test**

```bash
npm run dev &
DEV_PID=$!
sleep 3
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/admin
# Expected: 200 (renders login form because no cookie)
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/webhook/nonexistent-id \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data 'From=whatsapp:%2B10000000000&Body=hi'
# Expected: 404 (bot not found) OR 500 if SUPABASE_SERVICE_ROLE_KEY not set locally — report which
kill $DEV_PID
```

- [ ] **Step 4: Definition-of-Done checklist**

- [ ] Migration `0002_admin_bypass.sql` created and committed (user applies manually in Supabase)
- [ ] `npm run build`, `npm run lint`, `npx tsc --noEmit`, `npm run format:check` all clean
- [ ] `/admin` GET returns 200 with login form when no cookie
- [ ] `/api/webhook/[botId]` POST with unknown id returns 404 (or reports which error if env vars missing)
- [ ] `.env.local.example` has `ADMIN_PASSWORD` and `ANTHROPIC_API_KEY`
- [ ] README has admin + webhook sections
- [ ] All new files use `'server-only'` where they handle secrets or the service role

- [ ] **Step 5: Report**

Report final `git log --oneline | head -20`, total commit count, build/lint/tsc output snippets, curl results, and any items that need user action (applying `0002_admin_bypass.sql`, setting env vars).

---

## Self-Review

**Coverage check:**

| Requirement | Task |
|---|---|
| Admin password env var `ADMIN_PASSWORD` | 1 |
| Admin cookie + bypass | 4, 5, 7 |
| `/admin` login form | 6, 7 |
| `/admin` dashboard with business + bot lists | 6, 7 |
| Create-bot form (business_name, bot_name, system_prompt, twilio_*) | 5, 6 |
| Schema change for admin-created businesses | 2 |
| Service-role Supabase client | 3 |
| `/api/webhook/[botId]` receives Twilio POST | 10 |
| Loads bot system_prompt from Supabase | 10 |
| Calls `claude-haiku-4-5-20251001` with system + history | 8, 10 |
| Prompt caching on system prompt | 8 |
| Saves user + assistant messages | 10 |
| Sends reply via Twilio REST with per-bot creds | 9, 10 |
| `ANTHROPIC_API_KEY` env var | 1 |
| README docs | 11 |

**Placeholder scan:** every step has concrete code, commands, and expected output. No TODOs inside code beyond the explicit "Security TODOs before production" section in the README, which is intentional documentation.

**Type consistency:** `ChatMessage` is exported from `lib/claude.ts` and imported as a type in `app/api/webhook/[botId]/route.ts`. Server actions return `{ error }` / `{ success }` shapes — UI does not render errors yet, which is acceptable for this temporary iteration (form submissions that fail will just re-render the dashboard without the new row; the server action log captures the error). Field names on the create-bot form match the keys read in `createBotAction`.
