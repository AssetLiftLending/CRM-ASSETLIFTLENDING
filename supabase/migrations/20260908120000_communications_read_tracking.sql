-- Threaded team inbox: read tracking + the indexes the conversation list needs.
--
-- The inbox groups communications by contact, shows the newest message per
-- contact, and counts inbound messages the user has not opened yet. Without
-- read_at there is no way to distinguish "new" from "already seen", and without
-- the composite index the per-contact ordering degrades to a full scan as the
-- communications table grows.

ALTER TABLE public.communications
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Thread view: every message for one contact, newest first.
CREATE INDEX IF NOT EXISTS communications_contact_created_idx
  ON public.communications (contact_id, created_at DESC);

-- Unread badges: only inbound, only unread. Partial index stays small.
CREATE INDEX IF NOT EXISTS communications_unread_idx
  ON public.communications (contact_id)
  WHERE direction = 'inbound' AND read_at IS NULL;

-- Existing history predates read tracking. Treat it as already seen so the
-- inbox does not open with every past message flagged as new.
UPDATE public.communications
  SET read_at = created_at
  WHERE read_at IS NULL
    AND direction = 'inbound'
    AND created_at < NOW() - INTERVAL '7 days';
