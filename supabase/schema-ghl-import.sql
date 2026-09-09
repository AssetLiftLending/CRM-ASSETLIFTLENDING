-- ============================================================
-- Asset Lift Lending CRM — GoHighLevel history import
-- Run in the Supabase SQL Editor. Safe to re-run.
-- ============================================================

-- Identifies a message by its id in the system it came from, so the import can
-- be re-run (or resumed after a failure) without duplicating history.
ALTER TABLE public.communications
  ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_comms_external_id
  ON public.communications(external_id)
  WHERE external_id IS NOT NULL;
