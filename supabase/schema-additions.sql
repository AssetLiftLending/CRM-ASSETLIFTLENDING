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
  ADD COLUMN IF NOT EXISTS after_repair_value BIGINT,
  ADD COLUMN IF NOT EXISTS credit_score     INTEGER,
  ADD COLUMN IF NOT EXISTS under_contract   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS exit_strategy    TEXT,
  ADD COLUMN IF NOT EXISTS occupancy        TEXT,
  ADD COLUMN IF NOT EXISTS title_company_contact TEXT,
  ADD COLUMN IF NOT EXISTS insurance_agent_contact TEXT,
  ADD COLUMN IF NOT EXISTS notes            TEXT,
  ADD COLUMN IF NOT EXISTS terms_set_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_set_by     UUID REFERENCES profiles(id);

-- 2b. Contact fields used by import, broker, and borrower signup flows
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS stage lead_stage DEFAULT 'new_inquiry';

ALTER TABLE deals
  ALTER COLUMN stage DROP DEFAULT,
  ALTER COLUMN stage TYPE TEXT USING stage::text,
  ALTER COLUMN stage SET DEFAULT 'new_lead';

ALTER TABLE contacts
  ALTER COLUMN stage DROP DEFAULT,
  ALTER COLUMN stage TYPE TEXT USING stage::text,
  ALTER COLUMN stage SET DEFAULT 'new_lead';

CREATE TABLE IF NOT EXISTS pipeline_stages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key             TEXT NOT NULL,
  label           TEXT NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  color           TEXT NOT NULL DEFAULT 'border-gray-300 bg-gray-50',
  is_closed       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (organization_id, key)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_org ON pipeline_stages(organization_id);

INSERT INTO pipeline_stages (organization_id, key, label, sort_order, color, is_closed)
SELECT org.id, stage.key, stage.label, stage.sort_order, stage.color, stage.is_closed
FROM organizations org
CROSS JOIN (
  VALUES
    ('new_lead', 'New lead', 1, 'border-blue-300 bg-blue-50', FALSE),
    ('pending_lead', 'Pending lead', 2, 'border-yellow-300 bg-yellow-50', FALSE),
    ('dead_lead', 'Dead lead', 3, 'border-red-300 bg-red-50', TRUE),
    ('in_progress', 'In the middle of progress', 4, 'border-gold-300 bg-gold-50', FALSE),
    ('closed_deal', 'Closed deal', 5, 'border-green-300 bg-green-50', TRUE)
) AS stage(key, label, sort_order, color, is_closed)
ON CONFLICT (organization_id, key) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    color = EXCLUDED.color,
    is_closed = EXCLUDED.is_closed;

UPDATE deals
SET stage = CASE stage
  WHEN 'new_inquiry' THEN 'new_lead'
  WHEN 'contacted' THEN 'pending_lead'
  WHEN 'just_searching' THEN 'pending_lead'
  WHEN 'dead_lead' THEN 'dead_lead'
  WHEN 'in_progress' THEN 'in_progress'
  WHEN 'funded' THEN 'closed_deal'
  ELSE COALESCE(stage, 'new_lead')
END;

UPDATE contacts
SET stage = CASE stage
  WHEN 'new_inquiry' THEN 'new_lead'
  WHEN 'contacted' THEN 'pending_lead'
  WHEN 'just_searching' THEN 'pending_lead'
  WHEN 'dead_lead' THEN 'dead_lead'
  WHEN 'in_progress' THEN 'in_progress'
  WHEN 'funded' THEN 'closed_deal'
  ELSE COALESCE(stage, 'new_lead')
END;

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
