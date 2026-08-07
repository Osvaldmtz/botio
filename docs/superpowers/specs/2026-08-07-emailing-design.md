# Emailing Section — Design Spec

Date: 2026-08-07  
Status: Approved

## Context

Botio needs an admin section to manage transactional email sequences for Kalyo trial/onboarding, powered by Resend.

## Decisions

| Topic | Choice |
|-------|--------|
| Route | `/admin/emailing` (after Dashboard in header tabs) |
| Theme | Existing Botio emerald tokens (not purple) |
| DB | Supabase migration `0054_emailing.sql` (not Prisma) |
| Admin APIs | `/api/admin/emailing/*` with `isAdmin()` cookie |
| Webhook | `POST /api/emailing/webhook` (Resend/Svix signature) |
| Delayed sends | `email_jobs` + cron `/api/cron/emailing-jobs` hourly |
| Sequence edit (v1) | Toggle `active` + `delay_days` only; subject/HTML via seed/migration |
| Provider | Resend only |

## Data model

### `email_sequences`

- `id`, `name`, `trigger_tag`, `cancel_on_tag` (nullable), `delay_days`, `subject`, `html_template`, `active`, `sort_order`, timestamps
- UI trigger label: if `cancel_on_tag` → `Sin {cancel_on_tag}`, else `trigger_tag`

Seeds (sort 1–6): Welcome (`trial-activo`, 0d), Completa perfil (`trial-activo` / cancel `onboarding-paso-1`, 2d), Agrega paciente (cancel `onboarding-paso-2`, 5d), Agenda cita (cancel `onboarding-paso-3`, 7d), Planes (`onboarding-completo`, 7d), Oferta 30% (`trial-expirado`, 0d).

### `email_logs`

- `id`, `to_email`, `sequence_id`, `resend_id`, `status` (`sent` \| `opened` \| `bounced`), `sent_at`, `opened_at`, `clicked_at`, `created_at`

### `email_jobs`

- `id`, `to_email`, `sequence_id`, `psychologist_name`, `run_at`, `status` (`pending` \| `sent` \| `cancelled` \| `failed`), `error`, timestamps

## Runtime flow

1. `triggerEmailSequence(email, tag, name?)` in `lib/email-tags.ts`
2. If `trial-convertido` → cancel all pending jobs for that email
3. Cancel pending jobs whose `cancel_on_tag` matches the tag
4. For each active sequence with `trigger_tag === tag`:
   - `delay_days === 0` → send via Resend, insert log `sent`
   - else → insert `email_jobs` with `run_at = now + delay`
5. Cron processes due pending jobs
6. Resend webhook updates log status (`opened` / `bounced`) and `clicked_at` on click

## UI (4 tabs)

1. **Enviados** — paginated logs table, status badges, preview modal, empty + skeletons
2. **Secuencias** — 6 cards; toggle + delay; “Editar email” readonly subject/HTML note
3. **Métricas** — month KPIs + per-sequence table (click rate from `clicked_at`)
4. **Preview** — sequence dropdown, iframe, test-send modal

## Env

- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`

## Out of scope (v1)

HTML editor, Mailchimp, Prisma, purple theme, `@tanstack/react-table`, negative-tag evaluation beyond cancel-on-tag + trial-activo scheduling.
