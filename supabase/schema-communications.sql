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

-- Inbound SMS and calls are matched to a contact by phone number.
CREATE INDEX IF NOT EXISTS idx_contacts_phone   ON public.contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_cell    ON public.contacts(cell_phone);
CREATE INDEX IF NOT EXISTS idx_contacts_email   ON public.contacts(lower(email));

-- Global activity feed ordering.
CREATE INDEX IF NOT EXISTS idx_comms_created    ON public.communications(created_at DESC);
