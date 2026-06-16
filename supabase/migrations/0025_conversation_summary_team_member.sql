-- Add is_team_member to conversation_summary view.
-- The column existed in conversations but was missing from the view,
-- causing a 400 error when the dashboard queried
-- ?needs_reply=eq.true&handoff_active=eq.false&or=(is_team_member.is.null,...)
-- which made the whole /api/admin/metrics endpoint fail silently with [object Object].

CREATE OR REPLACE VIEW conversation_summary AS
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
    c.webinar_link_sent_at,
    c.webinar_registered,
    b.name AS bot_name,
    count(m.id)::integer AS message_count,
    ( SELECT m2.content
           FROM messages m2
          WHERE m2.conversation_id = c.id
          ORDER BY m2.created_at DESC
         LIMIT 1) AS last_message_content,
    ( SELECT m2.role
           FROM messages m2
          WHERE m2.conversation_id = c.id
          ORDER BY m2.created_at DESC
         LIMIT 1) AS last_message_role,
    ( SELECT m2.role = 'user'::text AND NOT c.is_closed AND NOT c.handoff_active
           FROM messages m2
          WHERE m2.conversation_id = c.id
          ORDER BY m2.created_at DESC
         LIMIT 1) AS needs_reply,
    c.is_team_member
   FROM conversations c
     JOIN bots b ON b.id = c.bot_id
     LEFT JOIN messages m ON m.conversation_id = c.id
  GROUP BY c.id, c.customer_phone, c.bot_id, c.channel, c.session_id, c.created_at,
           c.lead_captured, c.is_closed, c.close_reason, c.closed_at, c.closure_reason,
           c.closure_note, c.closed_by, c.followup_sent, c.last_message_at, c.lead_score,
           c.lead_temperature, c.lead_country, c.lead_city, c.lead_intent, c.lead_signals,
           c.enriched_at, c.handoff_active, c.handoff_taken_by, c.handoff_started_at,
           c.pipeline_stage, c.pipeline_stage_updated_at, c.pipeline_stage_updated_by,
           c.is_ambassador, c.is_team_member, c.webinar_link_sent_at, c.webinar_registered,
           b.name;
