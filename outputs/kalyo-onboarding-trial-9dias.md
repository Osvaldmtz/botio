# Kalyo — Onboarding trial Max (9 días)

Flujo drip WhatsApp vía cron `runTrialOnboardingCron` (`lib/trial-onboarding-cron.ts`).

**Trial:** 7 días gratis de Max. Columnas legacy en DB (`day_7`, `day_13`, `day_15`) mapean a días narrativos 5, 6 y 7.

| Día | Horas desde inicio | Columna DB | Trigger | Contenido |
|-----|-------------------|------------|---------|-----------|
| 1 | 0h (inmediato) | `day_1_sent_at` | Enroll webhook | Welcome + credenciales + link login |
| 2 | 24h | `day_2_sent_at` | Cron | Recordatorio: crear primer paciente |
| 3 | 72h | `day_3_sent_at` | Cron | Evaluaciones PHQ-9 / GAD-7 |
| 5 | 120h | `day_7_sent_at` | Cron | Features estrella (Kaly voz + Kalyo Meet) + **PRIMER50 anticipado** |
| 6 | 144h | `day_13_sent_at` | Cron | Urgencia: trial termina mañana — responde MAX o PRO |
| 7 | 168h | `day_15_sent_at` | Cron | Trial venció — elige plan o pasa a Starter free |
| 8 | 192h | `day_8_sent_at` | Cron | Encuesta post-trial (precio, features, etc.) |
| 9 | 216h | `day_9_sent_at` | Cron (condicional) | **Recordatorio final PRIMER50** |

## PRIMER50 — dos toques

### Día 5 (120h) — oferta anticipada

- Se envía **durante el trial activo** (~2 días restantes).
- Mensaje: features Max + cupón PRIMER50 (50% OFF primer mes).
- Urgencia: *"Solo por los próximos 2 días de tu prueba"*.
- No requiere trial vencido ni haber pagado.
- Metadata en `messages`: `coupon_offered: true`, `coupon_code: PRIMER50`.

### Día 9 (216h) — recordatorio final

- Condiciones: trial vencido, día 7 enviado, no pagó, no unsubscribed, sin suscripción activa en Kalyo.
- Ángulo: ya vieron PRIMER50 en día 5 → *"Este es el recordatorio final"*.
- Repite cupón + links Stripe con `prefilled_promo_code=PRIMER50`.
- Ya **no** se suprime el cupón si fue ofrecido antes (comportamiento legacy eliminado).

## Entrega WhatsApp / Twilio

| Mensaje | Método Twilio | Template Meta |
|---------|---------------|---------------|
| Día 1 welcome | `ContentSid` (`KALYO_WELCOME_TEMPLATE_SID`) con fallback texto plano | **Sí — aprobado** |
| Días 2–9 drip | `Body` texto plano (`sendWhatsApp`) | **No** — mensajes de sesión / continuidad de conversación |

Los drips 2–9 no usan Content Templates de Twilio. El cambio de PRIMER50 al día 5 **no requiere** nueva aprobación de template en Meta.

## Links de pago

- Max: `buy.stripe.com/...?prefilled_promo_code=PRIMER50` → $19.50 primer mes
- Pro: `buy.stripe.com/...?prefilled_promo_code=PRIMER50` → $14.50 primer mes

Fuente: `lib/kalyo-pricing-data.ts`, `lib/kalyo-payment-links.ts`.

## Archivos clave

- `lib/trial-onboarding-messages.ts` — copy de cada día
- `lib/trial-onboarding-cron.ts` — scheduling y envío
- `lib/trial-onboarding-day9-eligibility.ts` — filtros día 9
- `lib/trial-onboarding-day8-survey.ts` — encuesta día 8
