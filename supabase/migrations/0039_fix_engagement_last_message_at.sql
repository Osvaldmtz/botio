-- Fix last_message_at fallback: conversations.last_message_at is updated by crons
-- and must not count when every stored message is automated onboarding/follow-up.

CREATE OR REPLACE VIEW public.conversation_summary AS
 SELECT c.id,
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
  GROUP BY c.id, c.customer_phone, c.bot_id, c.channel, c.session_id, c.created_at,
           c.lead_captured, c.is_closed, c.close_reason, c.closed_at, c.closure_reason,
           c.closure_note, c.closed_by, c.followup_sent, c.last_message_at, c.lead_score,
           c.lead_temperature, c.lead_country, c.lead_city, c.lead_intent, c.lead_signals,
           c.enriched_at, c.handoff_active, c.handoff_taken_by, c.handoff_started_at,
           c.pipeline_stage, c.pipeline_stage_updated_at, c.pipeline_stage_updated_by,
           c.is_ambassador, c.is_team_member, c.webinar_link_sent_at, c.webinar_registered,
           b.name;
