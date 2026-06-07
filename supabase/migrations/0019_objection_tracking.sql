CREATE TABLE IF NOT EXISTS public.detected_objections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id),
  customer_phone text NOT NULL,
  customer_email text,
  objection_type text NOT NULL CHECK (
    objection_type IN ('price', 'thinking', 'competition', 'no_time', 'not_useful', 'few_patients')
  ),
  trigger_message text NOT NULL,
  response_used text NOT NULL,
  customer_replied boolean DEFAULT false,
  customer_reply text,
  outcome text CHECK (
    outcome IN (
      'converted',
      'still_objecting',
      'no_response',
      'handoff',
      'pending',
      'follow_up_sent'
    )
    OR outcome IS NULL
  ),
  detected_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS detected_objections_conversation_idx
  ON detected_objections(conversation_id);

CREATE INDEX IF NOT EXISTS detected_objections_type_idx
  ON detected_objections(objection_type);

CREATE INDEX IF NOT EXISTS detected_objections_pending_idx
  ON detected_objections(detected_at)
  WHERE outcome IS NULL OR outcome = 'pending';
