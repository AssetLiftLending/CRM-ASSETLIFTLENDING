-- ============================================================
-- Asset Lift Lending CRM - Multi-tenant Auth Hardening
-- Run after schema.sql, schema-additions.sql, and schema-seo.sql.
-- Every tenant-owned table gets organization_id.
-- ============================================================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'broker';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'borrower';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'platform_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'organization_admin';

CREATE TABLE IF NOT EXISTS public.organizations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.organization_memberships (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            user_role NOT NULL DEFAULT 'loan_officer',
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (organization_id, user_id)
);

INSERT INTO public.organizations (name, slug)
VALUES ('Asset Lift Lending', 'asset-lift-lending')
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id),
  ADD COLUMN IF NOT EXISTS current_organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.contacts             ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.deals                ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.tasks                ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.task_comments        ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.communications       ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.documents            ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.email_templates      ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.email_campaigns      ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.automations          ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.automation_logs      ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.appointments         ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.ai_ad_drafts         ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.ai_suggestions       ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.ad_campaigns         ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.portal_applications  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.sms_templates        ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.broker_clients       ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.websites             ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.seo_audits           ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.generated_content    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.tracked_keywords     ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

CREATE TABLE IF NOT EXISTS public.document_folders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id      UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  portal_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  broker_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  storage_prefix  TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (organization_id, contact_id)
);

UPDATE public.profiles
SET
  organization_id = COALESCE(organization_id, (SELECT id FROM public.organizations WHERE slug = 'asset-lift-lending')),
  current_organization_id = COALESCE(current_organization_id, organization_id, (SELECT id FROM public.organizations WHERE slug = 'asset-lift-lending'));

UPDATE public.contacts            SET organization_id = COALESCE(organization_id, (SELECT id FROM public.organizations WHERE slug = 'asset-lift-lending'));
UPDATE public.deals               SET organization_id = COALESCE(organization_id, (SELECT organization_id FROM public.contacts WHERE contacts.id = deals.contact_id), (SELECT id FROM public.organizations WHERE slug = 'asset-lift-lending'));
UPDATE public.tasks               SET organization_id = COALESCE(organization_id, (SELECT organization_id FROM public.deals WHERE deals.id = tasks.deal_id), (SELECT organization_id FROM public.contacts WHERE contacts.id = tasks.contact_id), (SELECT id FROM public.organizations WHERE slug = 'asset-lift-lending'));
UPDATE public.task_comments       SET organization_id = COALESCE(organization_id, (SELECT organization_id FROM public.tasks WHERE tasks.id = task_comments.task_id), (SELECT id FROM public.organizations WHERE slug = 'asset-lift-lending'));
UPDATE public.communications      SET organization_id = COALESCE(organization_id, (SELECT organization_id FROM public.deals WHERE deals.id = communications.deal_id), (SELECT organization_id FROM public.contacts WHERE contacts.id = communications.contact_id), (SELECT id FROM public.organizations WHERE slug = 'asset-lift-lending'));
UPDATE public.documents           SET organization_id = COALESCE(organization_id, (SELECT organization_id FROM public.deals WHERE deals.id = documents.deal_id), (SELECT organization_id FROM public.contacts WHERE contacts.id = documents.contact_id), (SELECT id FROM public.organizations WHERE slug = 'asset-lift-lending'));
UPDATE public.email_templates     SET organization_id = COALESCE(organization_id, (SELECT id FROM public.organizations WHERE slug = 'asset-lift-lending'));
UPDATE public.email_campaigns     SET organization_id = COALESCE(organization_id, (SELECT id FROM public.organizations WHERE slug = 'asset-lift-lending'));
UPDATE public.automations         SET organization_id = COALESCE(organization_id, (SELECT id FROM public.organizations WHERE slug = 'asset-lift-lending'));
UPDATE public.automation_logs     SET organization_id = COALESCE(organization_id, (SELECT organization_id FROM public.automations WHERE automations.id = automation_logs.automation_id), (SELECT id FROM public.organizations WHERE slug = 'asset-lift-lending'));
UPDATE public.appointments        SET organization_id = COALESCE(organization_id, (SELECT organization_id FROM public.deals WHERE deals.id = appointments.deal_id), (SELECT organization_id FROM public.contacts WHERE contacts.id = appointments.contact_id), (SELECT id FROM public.organizations WHERE slug = 'asset-lift-lending'));
UPDATE public.ai_ad_drafts        SET organization_id = COALESCE(organization_id, (SELECT id FROM public.organizations WHERE slug = 'asset-lift-lending'));
UPDATE public.ai_suggestions      SET organization_id = COALESCE(organization_id, (SELECT organization_id FROM public.deals WHERE deals.id = ai_suggestions.deal_id), (SELECT organization_id FROM public.contacts WHERE contacts.id = ai_suggestions.contact_id), (SELECT id FROM public.organizations WHERE slug = 'asset-lift-lending'));
UPDATE public.ad_campaigns        SET organization_id = COALESCE(organization_id, (SELECT id FROM public.organizations WHERE slug = 'asset-lift-lending'));
UPDATE public.portal_applications SET organization_id = COALESCE(organization_id, (SELECT organization_id FROM public.contacts WHERE contacts.id = portal_applications.contact_id), (SELECT id FROM public.organizations WHERE slug = 'asset-lift-lending'));
UPDATE public.sms_templates       SET organization_id = COALESCE(organization_id, (SELECT id FROM public.organizations WHERE slug = 'asset-lift-lending'));
UPDATE public.broker_clients      SET organization_id = COALESCE(organization_id, (SELECT organization_id FROM public.profiles WHERE profiles.id = broker_clients.broker_id), (SELECT organization_id FROM public.contacts WHERE contacts.id = broker_clients.contact_id), (SELECT id FROM public.organizations WHERE slug = 'asset-lift-lending'));
UPDATE public.websites            SET organization_id = COALESCE(organization_id, (SELECT id FROM public.organizations WHERE slug = 'asset-lift-lending'));
UPDATE public.seo_audits          SET organization_id = COALESCE(organization_id, (SELECT organization_id FROM public.websites WHERE websites.id = seo_audits.website_id), (SELECT id FROM public.organizations WHERE slug = 'asset-lift-lending'));
UPDATE public.generated_content   SET organization_id = COALESCE(organization_id, (SELECT organization_id FROM public.websites WHERE websites.id = generated_content.website_id), (SELECT id FROM public.organizations WHERE slug = 'asset-lift-lending'));
UPDATE public.tracked_keywords    SET organization_id = COALESCE(organization_id, (SELECT organization_id FROM public.websites WHERE websites.id = tracked_keywords.website_id), (SELECT id FROM public.organizations WHERE slug = 'asset-lift-lending'));

INSERT INTO public.organization_memberships (organization_id, user_id, role, is_active)
SELECT organization_id, id, role, COALESCE(is_active, TRUE)
FROM public.profiles
WHERE organization_id IS NOT NULL
ON CONFLICT (organization_id, user_id) DO UPDATE
SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

CREATE INDEX IF NOT EXISTS idx_profiles_org ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON public.organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org ON public.organization_memberships(organization_id);
CREATE INDEX IF NOT EXISTS idx_contacts_org ON public.contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_deals_org ON public.deals(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_org ON public.tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_org ON public.task_comments(organization_id);
CREATE INDEX IF NOT EXISTS idx_comms_org ON public.communications(organization_id);
CREATE INDEX IF NOT EXISTS idx_docs_org ON public.documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_org ON public.email_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_org ON public.email_campaigns(organization_id);
CREATE INDEX IF NOT EXISTS idx_automations_org ON public.automations(organization_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_org ON public.automation_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_appointments_org ON public.appointments(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_ad_drafts_org ON public.ai_ad_drafts(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_org ON public.ai_suggestions(organization_id);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_org ON public.ad_campaigns(organization_id);
CREATE INDEX IF NOT EXISTS idx_portal_applications_org ON public.portal_applications(organization_id);
CREATE INDEX IF NOT EXISTS idx_sms_templates_org ON public.sms_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_broker_clients_org ON public.broker_clients(organization_id);
CREATE INDEX IF NOT EXISTS idx_websites_org ON public.websites(organization_id);
CREATE INDEX IF NOT EXISTS idx_seo_audits_org ON public.seo_audits(organization_id);
CREATE INDEX IF NOT EXISTS idx_generated_content_org ON public.generated_content(organization_id);
CREATE INDEX IF NOT EXISTS idx_tracked_keywords_org ON public.tracked_keywords(organization_id);
CREATE INDEX IF NOT EXISTS idx_document_folders_org ON public.document_folders(organization_id);
CREATE INDEX IF NOT EXISTS idx_document_folders_contact ON public.document_folders(contact_id);
CREATE INDEX IF NOT EXISTS idx_document_folders_portal_user ON public.document_folders(portal_user_id);

INSERT INTO public.document_folders (organization_id, contact_id, portal_user_id, broker_id, storage_prefix)
SELECT
  c.organization_id,
  c.id,
  c.portal_user_id,
  d.broker_id,
  'organizations/' || c.organization_id || '/contacts/' || c.id
FROM public.contacts c
LEFT JOIN LATERAL (
  SELECT broker_id
  FROM public.deals
  WHERE deals.contact_id = c.id AND deals.broker_id IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1
) d ON TRUE
WHERE c.organization_id IS NOT NULL
ON CONFLICT (organization_id, contact_id) DO UPDATE
SET
  portal_user_id = COALESCE(EXCLUDED.portal_user_id, document_folders.portal_user_id),
  broker_id = COALESCE(EXCLUDED.broker_id, document_folders.broker_id),
  storage_prefix = EXCLUDED.storage_prefix,
  updated_at = NOW();

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role::text = 'platform_admin'
      AND is_active = TRUE
  )
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships
    WHERE user_id = auth.uid()
      AND role::text = 'platform_admin'
      AND is_active = TRUE
  )
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(target_org UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_memberships
    WHERE user_id = auth.uid()
      AND organization_id = target_org
      AND is_active = TRUE
  )
  OR public.is_platform_admin()
$$;

CREATE OR REPLACE FUNCTION public.is_org_staff(target_org UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_memberships
    WHERE user_id = auth.uid()
      AND organization_id = target_org
      AND role::text IN ('organization_admin', 'owner', 'loan_officer', 'processor', 'marketing')
      AND is_active = TRUE
  )
  OR public.is_platform_admin()
$$;

CREATE OR REPLACE FUNCTION public.is_org_owner(target_org UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_memberships
    WHERE user_id = auth.uid()
      AND organization_id = target_org
      AND role::text IN ('organization_admin', 'owner')
      AND is_active = TRUE
  )
  OR public.is_platform_admin()
$$;

CREATE OR REPLACE FUNCTION public.set_default_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_org UUID;
BEGIN
  SELECT id INTO default_org FROM public.organizations WHERE slug = 'asset-lift-lending';
  NEW.organization_id := COALESCE(NEW.organization_id, default_org);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_profile_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_org UUID;
BEGIN
  target_org := COALESCE(NEW.current_organization_id, NEW.organization_id, (SELECT id FROM public.organizations WHERE slug = 'asset-lift-lending'));
  NEW.current_organization_id := target_org;
  NEW.organization_id := target_org;

  INSERT INTO public.organization_memberships (organization_id, user_id, role, is_active)
  VALUES (target_org, NEW.id, NEW.role, COALESCE(NEW.is_active, TRUE))
  ON CONFLICT (organization_id, user_id) DO UPDATE
  SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_contact_document_folder()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_org UUID;
  target_broker UUID;
BEGIN
  target_org := COALESCE(NEW.organization_id, (SELECT id FROM public.organizations WHERE slug = 'asset-lift-lending'));

  SELECT broker_id INTO target_broker
  FROM public.deals
  WHERE contact_id = NEW.id AND broker_id IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1;

  INSERT INTO public.document_folders (organization_id, contact_id, portal_user_id, broker_id, storage_prefix)
  VALUES (
    target_org,
    NEW.id,
    NEW.portal_user_id,
    target_broker,
    'organizations/' || target_org || '/contacts/' || NEW.id
  )
  ON CONFLICT (organization_id, contact_id) DO UPDATE
  SET
    portal_user_id = COALESCE(EXCLUDED.portal_user_id, document_folders.portal_user_id),
    broker_id = COALESCE(EXCLUDED.broker_id, document_folders.broker_id),
    storage_prefix = EXCLUDED.storage_prefix,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_membership ON public.profiles;
CREATE TRIGGER trg_profiles_membership
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_membership();

DROP TRIGGER IF EXISTS trg_contacts_document_folder ON public.contacts;
CREATE TRIGGER trg_contacts_document_folder
  AFTER INSERT OR UPDATE OF organization_id, portal_user_id ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.ensure_contact_document_folder();

DROP TRIGGER IF EXISTS trg_contacts_org ON public.contacts;
CREATE TRIGGER trg_contacts_org BEFORE INSERT ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_default_organization();
DROP TRIGGER IF EXISTS trg_deals_org ON public.deals;
CREATE TRIGGER trg_deals_org BEFORE INSERT ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.set_default_organization();
DROP TRIGGER IF EXISTS trg_tasks_org ON public.tasks;
CREATE TRIGGER trg_tasks_org BEFORE INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_default_organization();
DROP TRIGGER IF EXISTS trg_task_comments_org ON public.task_comments;
CREATE TRIGGER trg_task_comments_org BEFORE INSERT ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_default_organization();
DROP TRIGGER IF EXISTS trg_communications_org ON public.communications;
CREATE TRIGGER trg_communications_org BEFORE INSERT ON public.communications
  FOR EACH ROW EXECUTE FUNCTION public.set_default_organization();
DROP TRIGGER IF EXISTS trg_documents_org ON public.documents;
CREATE TRIGGER trg_documents_org BEFORE INSERT ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_default_organization();
DROP TRIGGER IF EXISTS trg_email_templates_org ON public.email_templates;
CREATE TRIGGER trg_email_templates_org BEFORE INSERT ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_default_organization();
DROP TRIGGER IF EXISTS trg_email_campaigns_org ON public.email_campaigns;
CREATE TRIGGER trg_email_campaigns_org BEFORE INSERT ON public.email_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_default_organization();
DROP TRIGGER IF EXISTS trg_automations_org ON public.automations;
CREATE TRIGGER trg_automations_org BEFORE INSERT ON public.automations
  FOR EACH ROW EXECUTE FUNCTION public.set_default_organization();
DROP TRIGGER IF EXISTS trg_automation_logs_org ON public.automation_logs;
CREATE TRIGGER trg_automation_logs_org BEFORE INSERT ON public.automation_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_default_organization();
DROP TRIGGER IF EXISTS trg_appointments_org ON public.appointments;
CREATE TRIGGER trg_appointments_org BEFORE INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_default_organization();
DROP TRIGGER IF EXISTS trg_ai_ad_drafts_org ON public.ai_ad_drafts;
CREATE TRIGGER trg_ai_ad_drafts_org BEFORE INSERT ON public.ai_ad_drafts
  FOR EACH ROW EXECUTE FUNCTION public.set_default_organization();
DROP TRIGGER IF EXISTS trg_ai_suggestions_org ON public.ai_suggestions;
CREATE TRIGGER trg_ai_suggestions_org BEFORE INSERT ON public.ai_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.set_default_organization();
DROP TRIGGER IF EXISTS trg_ad_campaigns_org ON public.ad_campaigns;
CREATE TRIGGER trg_ad_campaigns_org BEFORE INSERT ON public.ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_default_organization();
DROP TRIGGER IF EXISTS trg_portal_applications_org ON public.portal_applications;
CREATE TRIGGER trg_portal_applications_org BEFORE INSERT ON public.portal_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_default_organization();
DROP TRIGGER IF EXISTS trg_sms_templates_org ON public.sms_templates;
CREATE TRIGGER trg_sms_templates_org BEFORE INSERT ON public.sms_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_default_organization();
DROP TRIGGER IF EXISTS trg_broker_clients_org ON public.broker_clients;
CREATE TRIGGER trg_broker_clients_org BEFORE INSERT ON public.broker_clients
  FOR EACH ROW EXECUTE FUNCTION public.set_default_organization();
DROP TRIGGER IF EXISTS trg_websites_org ON public.websites;
CREATE TRIGGER trg_websites_org BEFORE INSERT ON public.websites
  FOR EACH ROW EXECUTE FUNCTION public.set_default_organization();
DROP TRIGGER IF EXISTS trg_seo_audits_org ON public.seo_audits;
CREATE TRIGGER trg_seo_audits_org BEFORE INSERT ON public.seo_audits
  FOR EACH ROW EXECUTE FUNCTION public.set_default_organization();
DROP TRIGGER IF EXISTS trg_generated_content_org ON public.generated_content;
CREATE TRIGGER trg_generated_content_org BEFORE INSERT ON public.generated_content
  FOR EACH ROW EXECUTE FUNCTION public.set_default_organization();
DROP TRIGGER IF EXISTS trg_tracked_keywords_org ON public.tracked_keywords;
CREATE TRIGGER trg_tracked_keywords_org BEFORE INSERT ON public.tracked_keywords
  FOR EACH ROW EXECUTE FUNCTION public.set_default_organization();

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_ad_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.websites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracked_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pipeline_stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organizations_member_select ON public.organizations;
CREATE POLICY organizations_member_select ON public.organizations
  FOR SELECT USING (public.is_org_member(id));

DROP POLICY IF EXISTS memberships_member_select ON public.organization_memberships;
CREATE POLICY memberships_member_select ON public.organization_memberships
  FOR SELECT USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS memberships_owner_manage ON public.organization_memberships;
CREATE POLICY memberships_owner_manage ON public.organization_memberships
  FOR ALL USING (public.is_org_owner(organization_id))
  WITH CHECK (public.is_org_owner(organization_id));

DROP POLICY IF EXISTS staff_all ON public.contacts;
DROP POLICY IF EXISTS staff_all_deals ON public.deals;
DROP POLICY IF EXISTS staff_all_tasks ON public.tasks;
DROP POLICY IF EXISTS staff_all_comms ON public.communications;
DROP POLICY IF EXISTS staff_all_docs ON public.documents;
DROP POLICY IF EXISTS profiles_own ON public.profiles;
DROP POLICY IF EXISTS staff_read_profiles ON public.profiles;
DROP POLICY IF EXISTS portal_own_docs ON public.documents;
DROP POLICY IF EXISTS broker_deals_select ON public.deals;
DROP POLICY IF EXISTS broker_deals_insert ON public.deals;
DROP POLICY IF EXISTS broker_deals_update ON public.deals;
DROP POLICY IF EXISTS broker_clients_select ON public.broker_clients;
DROP POLICY IF EXISTS broker_clients_insert ON public.broker_clients;
DROP POLICY IF EXISTS websites_admin ON public.websites;
DROP POLICY IF EXISTS seo_audits_admin ON public.seo_audits;
DROP POLICY IF EXISTS gen_content_admin ON public.generated_content;
DROP POLICY IF EXISTS tracked_kw_admin ON public.tracked_keywords;
DROP POLICY IF EXISTS task_comments_tenant_staff ON public.task_comments;
DROP POLICY IF EXISTS email_templates_tenant_staff ON public.email_templates;
DROP POLICY IF EXISTS email_campaigns_tenant_staff ON public.email_campaigns;
DROP POLICY IF EXISTS automations_tenant_staff ON public.automations;
DROP POLICY IF EXISTS automation_logs_tenant_staff ON public.automation_logs;
DROP POLICY IF EXISTS appointments_tenant_staff ON public.appointments;
DROP POLICY IF EXISTS ai_ad_drafts_tenant_staff ON public.ai_ad_drafts;
DROP POLICY IF EXISTS ai_suggestions_tenant_staff ON public.ai_suggestions;
DROP POLICY IF EXISTS ad_campaigns_tenant_staff ON public.ad_campaigns;
DROP POLICY IF EXISTS portal_applications_tenant_staff ON public.portal_applications;
DROP POLICY IF EXISTS portal_applications_portal_own ON public.portal_applications;
DROP POLICY IF EXISTS sms_templates_tenant_staff ON public.sms_templates;
DROP POLICY IF EXISTS document_folders_tenant_staff ON public.document_folders;
DROP POLICY IF EXISTS document_folders_portal_own ON public.document_folders;
DROP POLICY IF EXISTS document_folders_broker_own ON public.document_folders;
DROP POLICY IF EXISTS pipeline_stages_tenant_staff ON public.pipeline_stages;
DROP POLICY IF EXISTS pipeline_stages_tenant_read ON public.pipeline_stages;

CREATE POLICY profiles_own ON public.profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY profiles_org_staff_read ON public.profiles
  FOR SELECT USING (public.is_org_staff(organization_id));

CREATE POLICY pipeline_stages_tenant_read ON public.pipeline_stages
  FOR SELECT USING (public.is_org_member(organization_id));

CREATE POLICY pipeline_stages_tenant_staff ON public.pipeline_stages
  FOR ALL USING (public.is_org_staff(organization_id))
  WITH CHECK (public.is_org_staff(organization_id));

CREATE POLICY contacts_tenant_staff ON public.contacts
  FOR ALL USING (public.is_org_staff(organization_id))
  WITH CHECK (public.is_org_staff(organization_id));

CREATE POLICY contacts_portal_own ON public.contacts
  FOR SELECT USING (portal_user_id = auth.uid() OR email = auth.email());

CREATE POLICY deals_tenant_staff ON public.deals
  FOR ALL USING (public.is_org_staff(organization_id))
  WITH CHECK (public.is_org_staff(organization_id));

CREATE POLICY deals_broker_own ON public.deals
  FOR SELECT USING (broker_id = auth.uid());

CREATE POLICY deals_portal_own ON public.deals
  FOR SELECT USING (
    contact_id IN (
      SELECT id FROM public.contacts WHERE portal_user_id = auth.uid() OR email = auth.email()
    )
  );

CREATE POLICY tasks_tenant_staff ON public.tasks
  FOR ALL USING (public.is_org_staff(organization_id))
  WITH CHECK (public.is_org_staff(organization_id));

CREATE POLICY task_comments_tenant_staff ON public.task_comments
  FOR ALL USING (public.is_org_staff(organization_id))
  WITH CHECK (public.is_org_staff(organization_id));

CREATE POLICY communications_tenant_staff ON public.communications
  FOR ALL USING (public.is_org_staff(organization_id))
  WITH CHECK (public.is_org_staff(organization_id));

CREATE POLICY documents_tenant_staff ON public.documents
  FOR ALL USING (public.is_org_staff(organization_id))
  WITH CHECK (public.is_org_staff(organization_id));

CREATE POLICY documents_portal_own ON public.documents
  FOR SELECT USING (
    contact_id IN (
      SELECT id FROM public.contacts WHERE portal_user_id = auth.uid() OR email = auth.email()
    )
  );

CREATE POLICY documents_broker_own ON public.documents
  FOR SELECT USING (
    deal_id IN (SELECT id FROM public.deals WHERE broker_id = auth.uid())
  );

CREATE POLICY document_folders_tenant_staff ON public.document_folders
  FOR ALL USING (public.is_org_staff(organization_id))
  WITH CHECK (public.is_org_staff(organization_id));

CREATE POLICY document_folders_portal_own ON public.document_folders
  FOR SELECT USING (portal_user_id = auth.uid());

CREATE POLICY document_folders_broker_own ON public.document_folders
  FOR SELECT USING (broker_id = auth.uid());

CREATE POLICY broker_clients_tenant_staff ON public.broker_clients
  FOR ALL USING (public.is_org_staff(organization_id))
  WITH CHECK (public.is_org_staff(organization_id));

CREATE POLICY broker_clients_own ON public.broker_clients
  FOR SELECT USING (broker_id = auth.uid());

CREATE POLICY email_templates_tenant_staff ON public.email_templates
  FOR ALL USING (public.is_org_staff(organization_id))
  WITH CHECK (public.is_org_staff(organization_id));

CREATE POLICY email_campaigns_tenant_staff ON public.email_campaigns
  FOR ALL USING (public.is_org_staff(organization_id))
  WITH CHECK (public.is_org_staff(organization_id));

CREATE POLICY automations_tenant_staff ON public.automations
  FOR ALL USING (public.is_org_staff(organization_id))
  WITH CHECK (public.is_org_staff(organization_id));

CREATE POLICY automation_logs_tenant_staff ON public.automation_logs
  FOR ALL USING (public.is_org_staff(organization_id))
  WITH CHECK (public.is_org_staff(organization_id));

CREATE POLICY appointments_tenant_staff ON public.appointments
  FOR ALL USING (public.is_org_staff(organization_id))
  WITH CHECK (public.is_org_staff(organization_id));

CREATE POLICY ai_ad_drafts_tenant_staff ON public.ai_ad_drafts
  FOR ALL USING (public.is_org_staff(organization_id))
  WITH CHECK (public.is_org_staff(organization_id));

CREATE POLICY ai_suggestions_tenant_staff ON public.ai_suggestions
  FOR ALL USING (public.is_org_staff(organization_id))
  WITH CHECK (public.is_org_staff(organization_id));

CREATE POLICY ad_campaigns_tenant_staff ON public.ad_campaigns
  FOR ALL USING (public.is_org_staff(organization_id))
  WITH CHECK (public.is_org_staff(organization_id));

CREATE POLICY portal_applications_tenant_staff ON public.portal_applications
  FOR ALL USING (public.is_org_staff(organization_id))
  WITH CHECK (public.is_org_staff(organization_id));

CREATE POLICY portal_applications_portal_own ON public.portal_applications
  FOR SELECT USING (
    contact_id IN (
      SELECT id FROM public.contacts WHERE portal_user_id = auth.uid() OR email = auth.email()
    )
  );

CREATE POLICY sms_templates_tenant_staff ON public.sms_templates
  FOR ALL USING (public.is_org_staff(organization_id))
  WITH CHECK (public.is_org_staff(organization_id));

CREATE POLICY websites_tenant_staff ON public.websites
  FOR ALL USING (public.is_org_staff(organization_id))
  WITH CHECK (public.is_org_staff(organization_id));

CREATE POLICY seo_audits_tenant_staff ON public.seo_audits
  FOR ALL USING (public.is_org_staff(organization_id))
  WITH CHECK (public.is_org_staff(organization_id));

CREATE POLICY gen_content_tenant_staff ON public.generated_content
  FOR ALL USING (public.is_org_staff(organization_id))
  WITH CHECK (public.is_org_staff(organization_id));

CREATE POLICY tracked_kw_tenant_staff ON public.tracked_keywords
  FOR ALL USING (public.is_org_staff(organization_id))
  WITH CHECK (public.is_org_staff(organization_id));
