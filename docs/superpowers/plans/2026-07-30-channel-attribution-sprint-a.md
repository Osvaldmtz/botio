# Sprint A — Channel Attribution (Meta + Google) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture first-touch ad attribution on every lead (Meta Click-to-WhatsApp referral + Google UTMs/gclid), preserve it through trial enroll and Stripe paid, and surface 30-day funnel metrics by channel on `/admin/kpis`.

**Architecture:** Structured fields live in `conversations.metadata` (jsonb). Twilio webhook parses Meta referral params on first WA message; Kalyo enroll webhook accepts UTMs/gclid from landing; Stripe paid merges `paid_at` + `subscription_id` without overwriting `source`/`ad_channel`. Dashboard API joins Botio conversations with existing Meta/Google spend APIs for CAC/ROAS.

**Tech Stack:** Next.js App Router, Supabase (Botio DB), Twilio WhatsApp webhooks, Stripe webhooks, node:test.

## Global Constraints

- Exclude ambassadors from all sales/attribution metrics: `SALES_CONVERSATIONS_OR` (`is_ambassador.is.null,is_ambassador.eq.false`).
- First-touch only: never overwrite existing `metadata.ad_channel` or `metadata.source` on later messages.
- Meta attribution requires `ReferralSourceId` or `ReferralSourceType` from Twilio (Click-to-WhatsApp ads).
- Google attribution requires Kalyo landing to forward UTMs/gclid in enroll webhook (Botio accepts; Kalyo app change is a dependency).
- Stripe paid must preserve original `metadata.source`; add `paid_at` + `subscription_id` only.

---

## Current State (baseline)

| Area | Status |
|------|--------|
| UTM/gclid/referral | **None** — greenfield |
| `metadata.source` | Free-form string only (`kalyo_web`, etc.) |
| `isAdPrefillMessage` | Detects ad prefill text but **not persisted** |
| Trial enroll by-phone | **Bug:** overwrites metadata without spread |
| Stripe paid | Preserves metadata via spread — OK |
| KPI ads cards | Platform conversions only — no Botio join |

---

## File Structure

| File | Responsibility |
|------|----------------|
| `lib/ad-attribution.ts` | Types, Twilio referral parser, Google UTM parser, merge helpers |
| `lib/ad-attribution.test.ts` | Unit tests for parsers + merge |
| `lib/ad-attribution-queries.ts` | 30d funnel by channel (leads/trials/paid) |
| `app/api/webhook/[botId]/route.ts` | Parse Twilio referral params → pass to processor |
| `lib/process-message.ts` | Apply first-touch attribution after upsert |
| `lib/trial-onboarding-webhook.ts` | Accept UTMs/gclid; fix metadata merge bug |
| `lib/conversation-outcome.ts` | Add `paid_at` + `subscription_id` on paid |
| `lib/stripe-paid-webhook.ts` | Pass subscription id to `processCustomerPaid` |
| `app/api/ads/attribution/route.ts` | Admin API: channel funnel + CAC/ROAS |
| `components/admin/kpis/attribution-card.tsx` | Dashboard table |
| `app/admin/kpis/components/executive-kpi-dashboard.tsx` | Mount AttributionCard |

**Out of repo (blocker):** Kalyo landing (`kalyo.io`) — localStorage UTMs + forward on signup webhook.

---

### Task 1: Ad attribution types + Twilio Meta parser

**Files:**
- Create: `lib/ad-attribution.ts`
- Test: `lib/ad-attribution.test.ts`

**Interfaces:**
- Produces: `parseTwilioMetaReferral(params)`, `buildGoogleAdsMetadata(fields)`, `mergeAttributionMetadata(existing, patch)`, `hasExistingAttribution(metadata)`

- [ ] **Step 1: Write failing tests** — referral parsing, empty params, merge preserves existing
- [ ] **Step 2: Run tests** — `node --import tsx --test lib/ad-attribution.test.ts` → FAIL
- [ ] **Step 3: Implement** `lib/ad-attribution.ts`
- [ ] **Step 4: Run tests** → PASS
- [ ] **Step 5: Commit** — `feat: add ad attribution parsers and merge helpers`

---

### Task 2: Twilio webhook → first-touch Meta attribution

**Files:**
- Modify: `app/api/webhook/[botId]/route.ts` — extract referral from `twilioParams`
- Modify: `lib/process-message.ts` — extend `ProcessIncomingMessageInput` with `attribution?`; call merge after upsert when new/empty

**Metadata written on first Meta ad click:**
```typescript
{
  source: 'meta_ads',
  ad_channel: 'meta',
  utm_source: 'facebook',
  utm_medium: 'paid_social',
  ad_campaign_id: referralSourceId,
  ad_headline: referralHeadline,
  ad_referral_body: referralBody,
  ad_referral_source_type: referralSourceType, // 'ad' | 'post'
  referral_ctwa_clid: referralCtwaClid,
}
```

- [ ] **Step 1: Write test** for webhook param → metadata (can unit-test parser only; integration optional)
- [ ] **Step 2: Wire webhook + process-message**
- [ ] **Step 3: Verify** existing conversations not overwritten
- [ ] **Step 4: Commit** — `feat: capture Meta Click-to-WhatsApp referral on first WA message`

---

### Task 3: Google Ads attribution via trial enroll webhook

**Files:**
- Modify: `lib/trial-onboarding-webhook.ts` — `validateTrialEnrollBody` accepts `utm_source`, `utm_medium`, `utm_campaign`, `gclid`; `createKalyoConversation` merges metadata (fix by-phone overwrite bug)

**Payload extension:**
```typescript
{ email, name, phone?, gclid?, utm_source?, utm_medium?, utm_campaign? }
```

**Metadata when gclid or utm_source=google:**
```typescript
{
  source: 'google_ads',
  ad_channel: 'google',
  utm_source: 'google',
  utm_medium: 'cpc',
  gclid, utm_campaign,
}
```

- [ ] **Step 1: Fix by-phone metadata spread bug** (lines ~390-394)
- [ ] **Step 2: Extend validate + createKalyoConversation**
- [ ] **Step 3: Add tests** for enroll body validation + google metadata builder
- [ ] **Step 4: Commit** — `feat: google ads attribution on trial enroll + fix metadata merge`

**Blocker:** Kalyo landing must send UTMs — document in CLAUDE.md; provide snippet for Kalyo team.

---

### Task 4: Stripe paid — preserve source, add paid_at + subscription_id

**Files:**
- Modify: `lib/conversation-outcome.ts` — `setConversationOutcome` accepts optional `metadataPatch`; `processCustomerPaid` accepts `{ subscriptionId? }`
- Modify: `lib/stripe-paid-webhook.ts` — pass `subscription.id` from subscription events

- [ ] **Step 1: Test** paid merge preserves `source=google_ads`, adds `paid_at`
- [ ] **Step 2: Implement**
- [ ] **Step 3: Commit** — `feat: stripe paid preserves ad attribution metadata`

---

### Task 5: Dashboard — Atribución por canal (30d)

**Files:**
- Create: `lib/ad-attribution-queries.ts`
- Create: `app/api/ads/attribution/route.ts`
- Create: `components/admin/kpis/attribution-card.tsx`
- Modify: `app/admin/kpis/components/executive-kpi-dashboard.tsx`

**Channel bucketing:**
| Channel | Rule |
|---------|------|
| Meta | `metadata.ad_channel = 'meta'` OR `metadata.source = 'meta_ads'` |
| Google | `metadata.ad_channel = 'google'` OR `metadata.source = 'google_ads'` |
| Web | `metadata.source = 'kalyo_web'` without ad_channel |
| Organic | everything else |

**Metrics:** Leads (created 30d), Trials (`outcome = trial_activated` or trial_onboarding join), Paid (`outcome = paid`), CAC/ROAS from spend APIs for Meta/Google only.

- [ ] **Step 1: Query lib + API route with `isAdmin()` gate**
- [ ] **Step 2: AttributionCard UI**
- [ ] **Step 3: Mount below ChannelCompareCard**
- [ ] **Step 4: Commit** — `feat: channel attribution dashboard (30d)`

---

### Task 6: Ad URL documentation

**Files:**
- Modify: `CLAUDE.md` — add URL templates for Meta/Google ads

**Meta:** `https://wa.me/15559374917?text=Hola%20vengo%20de%20{campaign_name}`
**Google:** `https://kalyo.io?utm_source=google&utm_medium=cpc&utm_campaign={campaign}&gclid={gclid}`

- [ ] **Step 1: Document URLs + Kalyo landing dependency**
- [ ] **Step 2: Commit** — `docs: ad URL templates for attribution`

---

## Test Plan (acceptance)

1. Twilio webhook with `ReferralSourceId` → conversation `metadata.source = meta_ads`
2. Enroll with `gclid` → `metadata.source = google_ads`
3. Stripe subscription.created → paid conversation keeps `source`, adds `paid_at`
4. `/admin/kpis` shows Meta/Google/Web/Organic rows with counts

---

## Blockers

| Blocker | Owner | Impact |
|---------|-------|--------|
| Kalyo landing UTMs → enroll webhook | Kalyo app repo | Google Ads attribution incomplete until deployed |
| Meta ads using correct WA number | Marketing | Referral only works on configured Click-to-WA ads |
| 2-4 weeks data collection | Time | CAC/ROAS decisions need post-deploy window |

---

## Ready for Push Checklist

- [ ] All unit tests pass: `node --import tsx --test lib/ad-attribution.test.ts`
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] Manual: POST enroll with gclid in staging
- [ ] Manual: verify dashboard loads on `/admin/kpis`
