-- ============================================================
-- Asset Lift Lending CRM — Per-deal document requests
-- Run in the Supabase SQL Editor. Safe to re-run.
-- ============================================================

-- Documents the lender asks for on top of the standard checklist. Stored per
-- deal so the borrower's portal shows exactly what was requested of them.
CREATE TABLE IF NOT EXISTS public.deal_document_requirements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id),
  deal_id         UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  key             TEXT NOT NULL,
  label           TEXT NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (deal_id, key)
);

CREATE INDEX IF NOT EXISTS idx_doc_reqs_deal
  ON public.deal_document_requirements(deal_id, sort_order);

ALTER TABLE public.deal_document_requirements ENABLE ROW LEVEL SECURITY;

-- Staff manage requests for deals in their organization.
DROP POLICY IF EXISTS "staff_manage_doc_requirements" ON public.deal_document_requirements;
CREATE POLICY "staff_manage_doc_requirements" ON public.deal_document_requirements
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
  );

-- Borrowers read the requests on their own deal so the portal checklist matches.
DROP POLICY IF EXISTS "borrower_reads_own_doc_requirements" ON public.deal_document_requirements;
CREATE POLICY "borrower_reads_own_doc_requirements" ON public.deal_document_requirements
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.deals d
      JOIN public.contacts c ON c.id = d.contact_id
      WHERE d.id = deal_document_requirements.deal_id
        AND (c.portal_user_id = auth.uid() OR lower(c.email) = lower(auth.jwt() ->> 'email'))
    )
  );
