# Sprint B — Trial→Paid Conversion (0.35% → 5-10%) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Diagnose where trials drop off in the 7-day funnel, learn from the one paid conversion (Rosa Isela), and implement targeted interventions to reach 5% trial→paid within 60 days.

**Architecture:** Phase 1 is read-only analytics (Supabase + Kalyo DB). Phase 2 implements WhatsApp surveys, personalized day-15 reactivation, and optional PRIMER50 A/B via existing `ab_experiments` infra. Depends on Sprint A for channel attribution on Rosa's journey.

**Tech Stack:** Supabase (Botio + Kalyo), trial onboarding cron, Twilio, Stripe, node:test.

## Global Constraints

- Exclude ambassadors from all sales metrics (`SALES_CONVERSATIONS_OR`).
- PRIMER50 is last-resort per `kalyo-bot-options.ts` — any A/B must not violate policy without explicit approval.
- Trial drip day mapping: DB `day_7` = narrative day 5, `day_13` = day 6, `day_15` = day 7 expired, `day_9` = PRIMER50 at 216h.
- KPI target: **5% trial→paid in 60 days** (baseline ~0.33%: 1 paid / 302 trials 30d).

---

## Diagnostic Snapshot (2026-07-30)

### Funnel — 302 trials (last 30d)

| Stage | Count | % of total |
|-------|-------|------------|
| Welcome sent (d1) | 240 | 79% |
| Day 2 message | 165 | 55% |
| Day 3 message | 237 | 78% |
| Day 5 message (col day_7) | 167 | 55% |
| Day 6 message (col day_13) | 123 | 41% |
| Day 7 expired (col day_15) | 103 | 34% |
| Customer responded | 94 | 31% |
| Unsubscribed | 0 | 0% |
| Paid (trial_onboarding) | 0 | 0% |

**Drop-off hypothesis:** Largest gap between day 3 (237) → day 6 (123) and day 6 → day 7 (103). Day 2 skip rate high (240→165). Engagement (31% responded) is low before expiry messaging.

### Paid user — Rosa Isela

| Field | Value |
|-------|-------|
| Email | psi.rosaiselas@gmail.com |
| Source | `kalyo_web` (web-only signup) |
| Outcome source | `kalyo_upgrade` (not Stripe webhook path) |
| Created + paid | Same timestamp — 2026-07-07 |
| Trial onboarding link | **None** — paid tracked only via conversation |

**Insight:** Rosa converted via Kalyo app upgrade webhook, not WhatsApp drip. No trial_onboarding row.

**Deep-dive (2026-07-31):** 14 pacientes, 154 assessments, plan `starter`/`active`. Power user web — el patrón a replicar es activación profunda en app.

### Engagement summary (302 trials — `scripts/trial-funnel-diagnostic.ts`)

| Paso | % |
|------|---|
| Login durante trial | 30.1% |
| ≥1 paciente | **72.2%** |
| ≥1 test | 23.8% |
| Respondió WA | 31.1% |

**Hipótesis:** cuello de botella = profundidad (login + tests), no crear paciente.

---

## Phase 1: Diagnosis (Week 1-2, parallel to Sprint A)

### Task 1: Kalyo product engagement query

**Data source:** Kalyo Supabase `psychologists` + related tables via `lib/kalyo-supabase.ts`

**Queries needed:**
- Trials last 30d: logged in? (`last_login_at`)
- Created ≥1 patient?
- Applied ≥1 test (PHQ-9/GAD-7)?
- Used Kaly voice feature?
- Days active during trial

**Files:**
- Create: `scripts/trial-funnel-diagnostic.ts` (one-off report)
- Or: `app/api/admin/analytics/trial-funnel/route.ts` (reusable)

- [ ] **Step 1: Map Kalyo tables** for patients, tests, voice usage
- [ ] **Step 2: Run diagnostic** on 302 trial emails
- [ ] **Step 3: Output CSV/table** with step completion rates

---

### Task 2: Rosa Isela deep-dive

- [ ] **Step 1: Query Kalyo DB** for Rosa's account activity
- [ ] **Step 2: Document** patients, tests, voice, days active, acquisition path
- [ ] **Step 3: Compare** to median non-converter

---

### Task 3: Drip delivery audit

**Files:** `lib/trial-onboarding-cron.ts`, `trial_onboarding_messages`

- [ ] **Step 1: Count trials where d1=false** (62 in sample — why?)
- [ ] **Step 2: Cross-check web-only** signups (no WhatsApp → no drip)
- [ ] **Step 3: Report** abandon before vs after day 3-5 messages

---

## Phase 2: Interventions (Week 2-3)

### Task 4: Day 8 survey (post-trial)

**New cron day or one-shot campaign:**
```
"¿Qué te faltó para continuar con Kalyo?"
Opciones: precio / features / no me sirvió / no tuve tiempo / no la usé
```

**Files:**
- Create: `lib/trial-onboarding-day8-survey.ts`
- Migration: `day_8_sent_at`, `day_8_response` on `trial_onboarding_messages`
- Modify: `lib/trial-onboarding-interceptor.ts` — parse survey replies

- [ ] **Step 1: Migration + message copy**
- [ ] **Step 2: Cron slot** at 192h (day 8)
- [ ] **Step 3: Store responses** in metadata or new column
- [ ] **Step 4: Admin view** on `/admin/trial-onboarding`

---

### Task 5: Personalized day 15 reactivation

**Files:** `lib/trial-onboarding-messages.ts`, `lib/trial-onboarding-cron.ts`

Branches:
- Used Kaly voice → emphasize Max
- Only applied tests → emphasize Pro
- Never logged in → special reengagement

Requires Kalyo engagement flags (Task 1).

- [ ] **Step 1: Fetch engagement segment** before send
- [ ] **Step 2: Three message templates**
- [ ] **Step 3: Wire into day 15 cron**

---

### Task 6: PRIMER50 day 9 A/B test (optional)

**Note:** PRIMER50 today is conditional coupon, not A/B. Use `lib/ab-testing.ts` to create experiment:
- Control: no coupon on day 9
- Variant: PRIMER50 on day 9

**Files:** `lib/ab-testing.ts`, new experiment seed migration

- [ ] **Step 1: Define experiment** + assignment at enroll
- [ ] **Step 2: Branch day 9 cron** by assignment
- [ ] **Step 3: Measure** paid rate at 30d

---

### Task 7: Sofia objection handling audit

**Files:** `lib/objection-interceptor.ts`, `lib/kalyo-bot-options.ts`

- [ ] **Step 1: Sample 20 price objections** — does Sofia compare Doctoralia/Heiko?
- [ ] **Step 2: Report** clarity score
- [ ] **Step 3: Prompt tweak** if needed (separate PR)

---

## Phase 3: Measurement (Week 4)

### Task 8: Combined KPI dashboard

- [ ] Trial→paid rate by channel (needs Sprint A)
- [ ] Survey response breakdown
- [ ] Engagement segment → conversion correlation
- [ ] PRIMER50 A/B results (if launched)

---

## Blockers

| Blocker | Impact |
|---------|--------|
| Kalyo DB access for engagement | Can't segment day-15 messages without Task 1 |
| Rosa has no trial_onboarding row | Deep-dive requires Kalyo-only data |
| 0 paid in 30d via drip | Sample size too small for A/B — need 4-8 weeks |
| Sprint A attribution | Can't measure channel-specific trial→paid until deployed |

---

## Success Criteria (60 days)

- [ ] Diagnostic report with abandonment step identified
- [ ] Day 8 survey live, ≥50 responses in 2 weeks
- [ ] Trial→paid ≥ 5% (rolling 30d)
- [ ] Action plan per abandonment point documented
