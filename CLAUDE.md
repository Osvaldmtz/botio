# Botio — Guía para agentes

## Embajadores vs Clientes (CRÍTICO)

### Definiciones

- **Cliente:** psicólogo que pagará Kalyo (target principal de ventas).
- **Embajador:** estudiante o aliado que recomienda Kalyo a cambio de comisión.

### Reglas duras

- TODA query de venta DEBE excluir `is_ambassador = true` (usar `SALES_CONVERSATIONS_OR` en `lib/ambassador-filters.ts`).
- Embajadores NO aparecen en métricas de `/admin/dashboard` (funnel, MRR context, objeciones).
- Embajadores NO aparecen en `/admin/conversations/pipeline`.
- Embajadores NO entran a A/B tests (`ensureConversationAssignments`).
- Embajadores NO generan HOT lead alerts (`enrichAndNotifyLead`).
- Embajadores NO se enrolan en trial onboarding (`enrollTrialFromKalyoWebhook`).
- Embajadores NO disparan detección de objeciones de venta (`detectObjection`).
- Embajadores tienen vista propia: `/admin/ambassadors`.

### Cuando agregar feature nueva

Pregunta: ¿esta feature aplica a clientes Y embajadores?

- Si solo clientes → filtrar `WHERE is_ambassador = false OR is_ambassador IS NULL`
- Si solo embajadores → filtrar `WHERE is_ambassador = true`
- Si ambos → no filtrar (raro; justificar)

### Columnas relevantes

- `conversations.is_ambassador` (boolean)
- `conversations.webinar_link_sent_at`, `webinar_registered`
- `metadata.is_ambassador_lead`, `metadata.webinar_attended`

## Google Ads — credenciales (Vercel: coloris/botio)

Integración directa vía OAuth en `lib/google-ads-api.ts`. Script one-time: `scripts/google-ads-oauth.ts`.

| Variable | Dónde vive | Valor / estado |
|----------|------------|----------------|
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Vercel Production + Preview | Test token (Acceso al Explorador) |
| `GOOGLE_ADS_CUSTOMER_ID` | Vercel Production + Preview + Development | `4356627994` (cuenta con campañas) |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | Vercel Production + Preview | `2224952854` (MCC manager) |
| `GOOGLE_ADS_CLIENT_ID` | Vercel + `.env.local` | `kalyo-production` OAuth Desktop app |
| `GOOGLE_ADS_CLIENT_SECRET` | Vercel + `.env.local` | Configurado (Production + Preview) |
| `GOOGLE_ADS_REFRESH_TOKEN` | Vercel Production + Preview | Configurado (OAuth osvamtz@gmail.com) |

**Fallback Composio** (legacy): `COMPOSIO_API_KEY`, `COMPOSIO_USER_ID`, `COMPOSIO_GOOGLEADS_CONNECTED_ACCOUNT_ID`. Si `GOOGLE_ADS_DEVELOPER_TOKEN` está seteado, la API directa OAuth tiene prioridad y Composio no se usa.

**Dashboard:** `/admin/kpis` → panel Google Ads · API `GET /api/google-ads/summary` · caché 4h en `meta_cache`.

## Atribución de canales (Meta + Google)

**Objetivo:** saber de qué canal viene cada lead, trial y paid. Campos en `conversations.metadata` (first-touch, nunca sobreescribir `ad_channel` existente).

| Origen | Captura | Campos clave |
|--------|---------|--------------|
| Meta Click-to-WA | Twilio webhook `ReferralSourceId`, `ReferralHeadline`, etc. | `source=meta_ads`, `ad_channel=meta`, `ad_campaign_id` |
| Google Ads landing | Webhook enroll `POST /api/internal/trial-onboarding/enroll` | `source=google_ads`, `ad_channel=google`, `gclid`, `utm_*` |
| Stripe paid | `lib/stripe-paid-webhook.ts` | Preserva source; agrega `paid_at`, `subscription_id` |

**URLs para ads:**
- Meta WA: `https://wa.me/15559374917?text=Hola%20vengo%20de%20{campaign_name}`
- Google landing: `https://kalyo.io?utm_source=google&utm_medium=cpc&utm_campaign={campaign}&gclid={gclid}`

**Dashboard:** `/admin/kpis` → "Atribución por canal (30d)" · API `GET /api/ads/attribution`

**Dependencia Kalyo app:** la landing debe guardar UTMs/gclid (localStorage/cookie) y enviarlos en el body del enroll webhook (`gclid`, `utm_source`, `utm_medium`, `utm_campaign`).

**Código:** `lib/ad-attribution.ts`, `lib/ad-attribution-queries.ts`, tests en `lib/ad-attribution.test.ts`.
