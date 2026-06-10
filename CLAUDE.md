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
