-- ============================================================
-- Asset Lift Lending CRM — Schema Additions
-- Run this in Supabase SQL Editor AFTER the main schema.sql
-- ============================================================

-- 1. Add portal roles to the user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'broker';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'borrower';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'platform_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'organization_admin';

-- 2. Add broker_id to deals (external broker who submitted the deal)
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS broker_id        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submitted_by     TEXT DEFAULT 'admin' CHECK (submitted_by IN ('admin','broker','borrower')),
  ADD COLUMN IF NOT EXISTS term_sheet_url   TEXT,
  ADD COLUMN IF NOT EXISTS rate             NUMERIC(5,3),      -- e.g. 12.500
  ADD COLUMN IF NOT EXISTS points           NUMERIC(4,2),      -- e.g. 2.50
  ADD COLUMN IF NOT EXISTS ltv              NUMERIC(5,2),      -- e.g. 75.00 (%)
  ADD COLUMN IF NOT EXISTS term_months      INTEGER,           -- e.g. 12
  ADD COLUMN IF NOT EXISTS experience       TEXT,
  ADD COLUMN IF NOT EXISTS experience_level TEXT,
  ADD COLUMN IF NOT EXISTS notes            TEXT,
  ADD COLUMN IF NOT EXISTS terms_set_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_set_by     UUID REFERENCES profiles(id);

-- 2b. Contact fields used by import, broker, and borrower signup flows
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS stage lead_stage DEFAULT 'new_inquiry';

-- 2c. Document fields used by upload routes
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS file_name   TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_by TEXT CHECK (uploaded_by IN ('staff','broker','borrower'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_deal_doc_type
  ON documents(deal_id, doc_type)
  WHERE deal_id IS NOT NULL;

-- 3. Broker profile extras (company name, license number)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS company_name     TEXT,
  ADD COLUMN IF NOT EXISTS license_number   TEXT,
  ADD COLUMN IF NOT EXISTS approved         BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS approved_at      TIMESTAMPTZ;

-- 4. Broker–contact relationship (broker submits deal for a borrower)
CREATE TABLE IF NOT EXISTS broker_clients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contact_id  UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(broker_id, contact_id)
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_deals_broker_id    ON deals(broker_id);
CREATE INDEX IF NOT EXISTS idx_broker_clients_broker ON broker_clients(broker_id);

-- 6. RLS: brokers see only their own deals
--    (add these policies after running the main schema)

-- Deals: brokers see only deals they submitted
DROP POLICY IF EXISTS broker_deals_select ON deals;
CREATE POLICY broker_deals_select ON deals
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role::text IN ('platform_admin','organization_admin','owner')
    )
    OR broker_id = auth.uid()
    OR contact_id IN (
      SELECT id FROM contacts WHERE portal_user_id = auth.uid() OR email = auth.email()
    )
  );

DROP POLICY IF EXISTS broker_deals_insert ON deals;
CREATE POLICY broker_deals_insert ON deals
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT id FROM profiles WHERE role::text IN ('platform_admin','organization_admin','owner','broker'))
  );

DROP POLICY IF EXISTS broker_deals_update ON deals;
CREATE POLICY broker_deals_update ON deals
  FOR UPDATE USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role::text IN ('platform_admin','organization_admin','owner'))
    OR broker_id = auth.uid()
  );

-- Broker clients: brokers see their own client links
ALTER TABLE broker_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS broker_clients_select ON broker_clients;
CREATE POLICY broker_clients_select ON broker_clients
  FOR SELECT USING (
    broker_id = auth.uid()
    OR auth.uid() IN (SELECT id FROM profiles WHERE role::text IN ('platform_admin','organization_admin','owner'))
  );

DROP POLICY IF EXISTS broker_clients_insert ON broker_clients;
CREATE POLICY broker_clients_insert ON broker_clients
  FOR INSERT WITH CHECK (
    broker_id = auth.uid()
    OR auth.uid() IN (SELECT id FROM profiles WHERE role::text IN ('platform_admin','organization_admin','owner'))
  );

-- 7. Approve broker function (called by admin)
CREATE OR REPLACE FUNCTION approve_broker(broker_uuid UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles
  SET approved = TRUE, approved_at = NOW()
  WHERE id = broker_uuid AND role = 'broker';
END;
$$;
