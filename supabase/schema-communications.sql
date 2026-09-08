-- ============================================================
-- Asset Lift Lending CRM — Communications delivery tracking
-- Run in the Supabase SQL Editor after the other schema files.
-- Safe to re-run.
-- ============================================================

-- Webhooks look messages up by their provider id on every callback
-- (SendGrid delivered/open/click, Twilio call + message status).
CREATE INDEX IF NOT EXISTS idx_comms_sendgrid_id
  ON public.communications(sendgrid_id)
  WHERE sendgrid_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_comms_twilio_sid
  ON public.communications(twilio_sid)
  WHERE twilio_sid IS NOT NULL;

-- Inbound SMS and calls arrive in E.164 (+15551234567) while contacts are stored
-- however they were imported ("(555) 123-4567", "555.123.4567", ...). These
-- generated columns hold the last 10 digits so inbound routing matches reliably.
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS phone_digits TEXT
    GENERATED ALWAYS AS (NULLIF(right(regexp_replace(COALESCE(phone, ''), '\D', '', 'g'), 10), '')) STORED,
  ADD COLUMN IF NOT EXISTS cell_phone_digits TEXT
    GENERATED ALWAYS AS (NULLIF(right(regexp_replace(COALESCE(cell_phone, ''), '\D', '', 'g'), 10), '')) STORED;

CREATE INDEX IF NOT EXISTS idx_contacts_phone_digits ON public.contacts(phone_digits);
CREATE INDEX IF NOT EXISTS idx_contacts_cell_digits  ON public.contacts(cell_phone_digits);
CREATE INDEX IF NOT EXISTS idx_contacts_email        ON public.contacts(lower(email));

-- Global activity feed ordering.
CREATE INDEX IF NOT EXISTS idx_comms_created    ON public.communications(created_at DESC);
