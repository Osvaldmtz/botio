-- Enable RLS on tables flagged by Supabase security advisors.
-- Ownership follows the existing chain: row -> conversations/bots -> businesses.owner_id = auth.uid()
-- Internal metrics/logs/admin tables have no user ownership column: deny public access;
-- backend continues via service_role (bypasses RLS).

-- ---------------------------------------------------------------------------
-- Conversation-scoped tables (ownership via conversation_id)
-- ---------------------------------------------------------------------------

ALTER TABLE public.pipeline_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all_pipeline_stage_history" ON public.pipeline_stage_history
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      JOIN public.bots bo ON bo.id = c.bot_id
      JOIN public.businesses b ON b.id = bo.business_id
      WHERE c.id = pipeline_stage_history.conversation_id
        AND b.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      JOIN public.bots bo ON bo.id = c.bot_id
      JOIN public.businesses b ON b.id = bo.business_id
      WHERE c.id = pipeline_stage_history.conversation_id
        AND b.owner_id = auth.uid()
    )
  );

ALTER TABLE public.ab_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all_ab_assignments" ON public.ab_assignments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      JOIN public.bots bo ON bo.id = c.bot_id
      JOIN public.businesses b ON b.id = bo.business_id
      WHERE c.id = ab_assignments.conversation_id
        AND b.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      JOIN public.bots bo ON bo.id = c.bot_id
      JOIN public.businesses b ON b.id = bo.business_id
      WHERE c.id = ab_assignments.conversation_id
        AND b.owner_id = auth.uid()
    )
  );

ALTER TABLE public.ab_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all_ab_outcomes" ON public.ab_outcomes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.ab_assignments a
      JOIN public.conversations c ON c.id = a.conversation_id
      JOIN public.bots bo ON bo.id = c.bot_id
      JOIN public.businesses b ON b.id = bo.business_id
      WHERE a.id = ab_outcomes.assignment_id
        AND b.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.ab_assignments a
      JOIN public.conversations c ON c.id = a.conversation_id
      JOIN public.bots bo ON bo.id = c.bot_id
      JOIN public.businesses b ON b.id = bo.business_id
      WHERE a.id = ab_outcomes.assignment_id
        AND b.owner_id = auth.uid()
    )
  );

ALTER TABLE public.detected_objections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all_detected_objections" ON public.detected_objections
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      JOIN public.bots bo ON bo.id = c.bot_id
      JOIN public.businesses b ON b.id = bo.business_id
      WHERE c.id = detected_objections.conversation_id
        AND b.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      JOIN public.bots bo ON bo.id = c.bot_id
      JOIN public.businesses b ON b.id = bo.business_id
      WHERE c.id = detected_objections.conversation_id
        AND b.owner_id = auth.uid()
    )
  );

ALTER TABLE public.hot_lead_alert_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all_hot_lead_alert_queue" ON public.hot_lead_alert_queue
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      JOIN public.bots bo ON bo.id = c.bot_id
      JOIN public.businesses b ON b.id = bo.business_id
      WHERE c.id = hot_lead_alert_queue.conversation_id
        AND b.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      JOIN public.bots bo ON bo.id = c.bot_id
      JOIN public.businesses b ON b.id = bo.business_id
      WHERE c.id = hot_lead_alert_queue.conversation_id
        AND b.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Bot-scoped table (ownership via bot_id; NULL bot_id = service_role only)
-- ---------------------------------------------------------------------------

ALTER TABLE public.ab_experiments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all_ab_experiments" ON public.ab_experiments
  FOR ALL
  USING (
    bot_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.bots bo
      JOIN public.businesses b ON b.id = bo.business_id
      WHERE bo.id = ab_experiments.bot_id
        AND b.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    bot_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.bots bo
      JOIN public.businesses b ON b.id = bo.business_id
      WHERE bo.id = ab_experiments.bot_id
        AND b.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Internal metrics / logs / admin tables (no user ownership column)
-- ---------------------------------------------------------------------------

ALTER TABLE public.twilio_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_public_read" ON public.twilio_metrics
  FOR SELECT USING (false);

ALTER TABLE public.clarity_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_public_read" ON public.clarity_metrics
  FOR SELECT USING (false);

ALTER TABLE public.pagespeed_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_public_read" ON public.pagespeed_history
  FOR SELECT USING (false);

ALTER TABLE public.kalyo_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_public_read" ON public.kalyo_metrics
  FOR SELECT USING (false);

ALTER TABLE public.meta_adset_budget_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_public_read" ON public.meta_adset_budget_logs
  FOR SELECT USING (false);

ALTER TABLE public.meta_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_public_read" ON public.meta_cache
  FOR SELECT USING (false);

ALTER TABLE public.cta_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_public_read" ON public.cta_events
  FOR SELECT USING (false);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_public_read" ON public.tasks
  FOR SELECT USING (false);

ALTER TABLE public.learning_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_public_read" ON public.learning_insights
  FOR SELECT USING (false);

ALTER TABLE public.roadmap_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_public_read" ON public.roadmap_reminders
  FOR SELECT USING (false);

-- ---------------------------------------------------------------------------
-- conversation_summary: recreate as SECURITY INVOKER so RLS of the querying
-- user applies to underlying tables (fixes security_definer_view advisor).
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS public.conversation_summary;

CREATE VIEW public.conversation_summary
WITH (security_invoker = true)
AS
SELECT
  c.id,
  c.customer_phone,
  c.bot_id,
  c.channel,
  c.session_id,
  c.created_at,
  c.lead_captured,
  c.is_closed,
  c.close_reason,
  c.closed_at,
  c.closure_reason,
  c.closure_note,
  c.closed_by,
  c.followup_sent,
  COALESCE(
    (
      SELECT max(m_eng.created_at)
      FROM public.messages m_eng
      WHERE m_eng.conversation_id = c.id
        AND NOT public.is_automated_metric_message(m_eng.role, m_eng.source, m_eng.metadata)
    ),
    (
      SELECT max(m_user.created_at)
      FROM public.messages m_user
      WHERE m_user.conversation_id = c.id
        AND m_user.role = 'user'
    ),
    c.created_at
  ) AS last_message_at,
  c.lead_score,
  c.lead_temperature,
  c.lead_country,
  c.lead_city,
  c.lead_intent,
  c.lead_signals,
  c.enriched_at,
  c.handoff_active,
  c.handoff_taken_by,
  c.handoff_started_at,
  c.pipeline_stage,
  c.pipeline_stage_updated_at,
  c.pipeline_stage_updated_by,
  c.is_ambassador,
  c.webinar_link_sent_at,
  c.webinar_registered,
  b.name AS bot_name,
  count(m.id) FILTER (
    WHERE NOT public.is_automated_metric_message(m.role, m.source, m.metadata)
  )::integer AS message_count,
  (
    SELECT m2.content
    FROM public.messages m2
    WHERE m2.conversation_id = c.id
      AND NOT public.is_automated_metric_message(m2.role, m2.source, m2.metadata)
    ORDER BY m2.created_at DESC
    LIMIT 1
  ) AS last_message_content,
  (
    SELECT m2.role
    FROM public.messages m2
    WHERE m2.conversation_id = c.id
      AND NOT public.is_automated_metric_message(m2.role, m2.source, m2.metadata)
    ORDER BY m2.created_at DESC
    LIMIT 1
  ) AS last_message_role,
  (
    SELECT m2.role = 'user'::text AND NOT c.is_closed AND NOT c.handoff_active
    FROM public.messages m2
    WHERE m2.conversation_id = c.id
      AND NOT public.is_automated_metric_message(m2.role, m2.source, m2.metadata)
    ORDER BY m2.created_at DESC
    LIMIT 1
  ) AS needs_reply,
  c.is_team_member
FROM public.conversations c
JOIN public.bots b ON b.id = c.bot_id
LEFT JOIN public.messages m ON m.conversation_id = c.id
GROUP BY
  c.id,
  c.customer_phone,
  c.bot_id,
  c.channel,
  c.session_id,
  c.created_at,
  c.lead_captured,
  c.is_closed,
  c.close_reason,
  c.closed_at,
  c.closure_reason,
  c.closure_note,
  c.closed_by,
  c.followup_sent,
  c.last_message_at,
  c.lead_score,
  c.lead_temperature,
  c.lead_country,
  c.lead_city,
  c.lead_intent,
  c.lead_signals,
  c.enriched_at,
  c.handoff_active,
  c.handoff_taken_by,
  c.handoff_started_at,
  c.pipeline_stage,
  c.pipeline_stage_updated_at,
  c.pipeline_stage_updated_by,
  c.is_ambassador,
  c.is_team_member,
  c.webinar_link_sent_at,
  c.webinar_registered,
  b.name;

GRANT SELECT ON public.conversation_summary TO anon, authenticated, service_role;
