CREATE TABLE IF NOT EXISTS public.scheduled_automation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID REFERENCES public.automations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  action JSONB NOT NULL,
  variables JSONB NOT NULL DEFAULT '{}',
  run_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  cancel_on_reply BOOLEAN NOT NULL DEFAULT TRUE,
  dedupe_key TEXT NOT NULL UNIQUE,
  locked_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  result JSONB,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.scheduled_automation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS email_opt_out BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_scheduled_actions_due
  ON public.scheduled_automation_actions (run_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_scheduled_actions_contact
  ON public.scheduled_automation_actions (contact_id, status);
CREATE INDEX IF NOT EXISTS idx_communications_sendgrid
  ON public.communications (sendgrid_id)
  WHERE sendgrid_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.claim_scheduled_automation_actions(batch_size INTEGER DEFAULT 25)
RETURNS SETOF public.scheduled_automation_actions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT id
    FROM public.scheduled_automation_actions
    WHERE
      (status = 'pending' AND run_at <= NOW())
      OR (status = 'processing' AND locked_at < NOW() - INTERVAL '15 minutes')
    ORDER BY run_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(batch_size, 1), 100)
  )
  UPDATE public.scheduled_automation_actions AS queued
  SET status = 'processing', locked_at = NOW(), attempts = queued.attempts + 1
  FROM picked
  WHERE queued.id = picked.id
  RETURNING queued.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_scheduled_automation_actions(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_scheduled_automation_actions(INTEGER) TO service_role;
