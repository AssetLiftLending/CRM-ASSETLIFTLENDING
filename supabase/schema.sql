-- ============================================================
-- ASSET LIFT LENDING — CRM DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('platform_admin', 'organization_admin', 'owner', 'loan_officer', 'processor', 'marketing', 'read_only', 'broker', 'borrower');
CREATE TYPE lead_stage AS ENUM ('new_inquiry', 'contacted', 'just_searching', 'dead_lead', 'in_progress', 'funded');
CREATE TYPE loan_program AS ENUM ('fix_flip', 'dscr', 'ground_up', 'commercial', 'multifamily', 'custom');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
CREATE TYPE comm_type AS ENUM ('call', 'sms', 'email', 'whatsapp', 'note', 'meeting');
CREATE TYPE comm_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE doc_status AS ENUM ('pending', 'uploaded', 'approved', 'rejected');
CREATE TYPE automation_trigger AS ENUM (
  'lead_created', 'stage_changed', 'deal_created', 'document_uploaded',
  'task_overdue', 'appointment_scheduled', 'deal_funded', 'no_contact_7d',
  'no_contact_30d', 'no_contact_60d', 'no_contact_90d'
);

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================

CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT UNIQUE NOT NULL,
  full_name     TEXT,
  phone         TEXT,
  cell_phone    TEXT,
  avatar_url    TEXT,
  role          user_role NOT NULL DEFAULT 'loan_officer',
  is_active     BOOLEAN DEFAULT TRUE,
  twilio_number TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CONTACTS
-- ============================================================

CREATE TABLE public.contacts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Basic Info
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  email             TEXT,
  phone             TEXT,
  cell_phone        TEXT,
  whatsapp          TEXT,
  address           TEXT,
  city              TEXT,
  state             TEXT,
  zip               TEXT,
  -- Lending Profile
  credit_score      INTEGER,
  ssn_encrypted     TEXT,   -- AES-256 encrypted
  entity_name       TEXT,   -- LLC name
  entity_type       TEXT,
  experience_count  INTEGER DEFAULT 0,  -- # of prior deals
  experience_states TEXT[], -- states they've done deals in
  annual_income     BIGINT,
  net_worth         BIGINT,
  -- CRM Fields
  lead_source       TEXT,   -- meta_ad, google_ad, landing_page, referral, email, direct
  lead_source_detail JSONB, -- campaign, ad_set, ad_name, keyword, cost
  assigned_to       UUID REFERENCES public.profiles(id),
  tags              TEXT[],
  is_archived       BOOLEAN DEFAULT FALSE,
  -- Portal
  portal_user_id    UUID REFERENCES auth.users(id),  -- borrower's login
  -- Meta
  created_by        UUID REFERENCES public.profiles(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DEALS (one contact can have many deals)
-- ============================================================

CREATE TABLE public.deals (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id          UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  -- Deal Identity
  title               TEXT,  -- e.g. "123 Main St Fix & Flip"
  loan_program        loan_program NOT NULL DEFAULT 'fix_flip',
  custom_program_name TEXT,  -- if loan_program = 'custom'
  stage               lead_stage NOT NULL DEFAULT 'new_inquiry',
  -- Property
  property_address    TEXT,
  property_city       TEXT,
  property_state      TEXT,
  property_zip        TEXT,
  property_type       TEXT,  -- SFR, MF, Commercial, Land
  -- Financials
  purchase_price      BIGINT,
  arv                 BIGINT,  -- After Repair Value
  rehab_amount        BIGINT,
  loan_amount         BIGINT,
  ltv                 NUMERIC(5,2),
  interest_rate       NUMERIC(5,3),
  loan_term_months    INTEGER,
  points              NUMERIC(4,2),
  -- Appraisal
  appraisal_ordered   BOOLEAN DEFAULT FALSE,
  appraisal_amount    INTEGER,  -- 550-850
  appraisal_paid      BOOLEAN DEFAULT FALSE,
  appraisal_stripe_id TEXT,
  -- Title & Insurance
  title_company_name  TEXT,
  title_company_email TEXT,
  title_company_phone TEXT,
  insurance_agent_name  TEXT,
  insurance_agent_email TEXT,
  insurance_agent_phone TEXT,
  -- Dates
  close_date_target   DATE,
  close_date_actual   DATE,
  funded_amount       BIGINT,
  -- Attribution
  lead_source         TEXT,
  lead_source_detail  JSONB,
  -- Team
  assigned_to         UUID REFERENCES public.profiles(id),
  created_by          UUID REFERENCES public.profiles(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TASKS
-- ============================================================

CREATE TABLE public.tasks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         TEXT NOT NULL,
  description   TEXT,
  priority      task_priority DEFAULT 'medium',
  status        task_status DEFAULT 'pending',
  due_date      TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  -- Relations
  contact_id    UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_id       UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  assigned_to   UUID REFERENCES public.profiles(id),
  created_by    UUID REFERENCES public.profiles(id),
  -- Recurrence
  is_recurring  BOOLEAN DEFAULT FALSE,
  recur_rule    TEXT,  -- 'daily', 'weekly', 'monthly', or cron
  -- Meta
  tags          TEXT[],
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.task_comments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id    UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id  UUID REFERENCES public.profiles(id),
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- COMMUNICATIONS (calls, sms, email, whatsapp, notes)
-- ============================================================

CREATE TABLE public.communications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id      UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  deal_id         UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  type            comm_type NOT NULL,
  direction       comm_direction,
  -- Content
  subject         TEXT,
  body            TEXT,
  snippet         TEXT,   -- preview line
  -- Call specific
  duration_secs   INTEGER,
  recording_url   TEXT,
  transcript      TEXT,
  ai_summary      TEXT,
  voicemail       BOOLEAN DEFAULT FALSE,
  -- Status
  status          TEXT,   -- delivered, failed, opened, clicked
  opened_at       TIMESTAMPTZ,
  clicked_at      TIMESTAMPTZ,
  -- External IDs
  twilio_sid      TEXT,
  sendgrid_id     TEXT,
  whatsapp_id     TEXT,
  -- Author
  user_id         UUID REFERENCES public.profiles(id),
  from_number     TEXT,
  to_number       TEXT,
  from_email      TEXT,
  to_email        TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DOCUMENTS
-- ============================================================

CREATE TABLE public.documents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id      UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  deal_id         UUID REFERENCES public.deals(id) ON DELETE CASCADE,
  -- File
  name            TEXT NOT NULL,
  doc_type        TEXT NOT NULL,  -- 'government_id', 'ssn', 'llc_docs', 'purchase_contract', etc.
  file_url        TEXT,
  file_size       BIGINT,
  mime_type       TEXT,
  storage_path    TEXT,
  -- Status
  status          doc_status DEFAULT 'pending',
  reviewed_by     UUID REFERENCES public.profiles(id),
  reviewed_at     TIMESTAMPTZ,
  review_notes    TEXT,
  -- Requested
  requested_at    TIMESTAMPTZ DEFAULT NOW(),
  uploaded_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EMAIL CAMPAIGNS & TEMPLATES
-- ============================================================

CREATE TABLE public.email_templates (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  subject     TEXT NOT NULL,
  html_body   TEXT NOT NULL,
  text_body   TEXT,
  category    TEXT,  -- nurture, follow_up, document_request, announcement
  tags        TEXT[],
  created_by  UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.email_campaigns (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  subject         TEXT NOT NULL,
  html_body       TEXT NOT NULL,
  from_name       TEXT DEFAULT 'Asset Lift Lending',
  from_email      TEXT DEFAULT 'info@assetliftlending.com',
  status          TEXT DEFAULT 'draft',  -- draft, scheduled, sending, sent
  scheduled_at    TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  recipient_count INTEGER DEFAULT 0,
  open_count      INTEGER DEFAULT 0,
  click_count     INTEGER DEFAULT 0,
  bounce_count    INTEGER DEFAULT 0,
  sendgrid_id     TEXT,
  segment_filter  JSONB,  -- filters used to select recipients
  created_by      UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUTOMATIONS
-- ============================================================

CREATE TABLE public.automations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  description   TEXT,
  trigger_type  automation_trigger NOT NULL,
  trigger_config JSONB DEFAULT '{}',  -- e.g. { stage: 'in_progress' }
  actions       JSONB NOT NULL DEFAULT '[]',  -- array of action objects
  is_active     BOOLEAN DEFAULT TRUE,
  run_count     INTEGER DEFAULT 0,
  last_run_at   TIMESTAMPTZ,
  created_by    UUID REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.automation_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  automation_id   UUID REFERENCES public.automations(id),
  contact_id      UUID REFERENCES public.contacts(id),
  deal_id         UUID REFERENCES public.deals(id),
  status          TEXT,  -- success, failed, skipped
  result          JSONB,
  error           TEXT,
  executed_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- APPOINTMENTS / CALENDAR
-- ============================================================

CREATE TABLE public.appointments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id      UUID REFERENCES public.contacts(id),
  deal_id         UUID REFERENCES public.deals(id),
  assigned_to     UUID REFERENCES public.profiles(id),
  title           TEXT NOT NULL,
  description     TEXT,
  start_time      TIMESTAMPTZ NOT NULL,
  end_time        TIMESTAMPTZ NOT NULL,
  timezone        TEXT DEFAULT 'America/New_York',
  location        TEXT,
  meeting_url     TEXT,
  google_event_id TEXT,
  status          TEXT DEFAULT 'confirmed',  -- confirmed, cancelled, no_show, completed
  reminder_sent   BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AI ITEMS (ad drafts, suggestions)
-- ============================================================

CREATE TABLE public.ai_ad_drafts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform        TEXT NOT NULL,  -- 'meta', 'google'
  campaign_goal   TEXT,
  target_audience TEXT,
  loan_program    TEXT,
  -- Generated content
  variations      JSONB NOT NULL DEFAULT '[]',
  -- Approval
  status          TEXT DEFAULT 'pending',  -- pending, approved, rejected, published
  approved_by     UUID REFERENCES public.profiles(id),
  approved_at     TIMESTAMPTZ,
  published_at    TIMESTAMPTZ,
  meta_ad_id      TEXT,
  google_ad_id    TEXT,
  -- Meta
  created_by      UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.ai_suggestions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id      UUID REFERENCES public.contacts(id),
  deal_id         UUID REFERENCES public.deals(id),
  type            TEXT NOT NULL,  -- 'follow_up', 'response', 'priority_score'
  suggestion      TEXT NOT NULL,
  reasoning       TEXT,
  priority_score  NUMERIC(3,1),
  is_acted        BOOLEAN DEFAULT FALSE,
  acted_at        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LEAD SOURCE ATTRIBUTION
-- ============================================================

CREATE TABLE public.ad_campaigns (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform        TEXT NOT NULL,  -- 'meta', 'google'
  campaign_id     TEXT,
  campaign_name   TEXT,
  ad_set_id       TEXT,
  ad_set_name     TEXT,
  ad_id           TEXT,
  ad_name         TEXT,
  spend           NUMERIC(10,2),
  impressions     INTEGER,
  clicks          INTEGER,
  leads           INTEGER DEFAULT 0,
  deals_funded    INTEGER DEFAULT 0,
  revenue         BIGINT DEFAULT 0,
  date_start      DATE,
  date_end        DATE,
  synced_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PORTAL (borrower access)
-- ============================================================

CREATE TABLE public.portal_applications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id      UUID REFERENCES public.contacts(id),
  -- Self-reported info from portal form
  form_data       JSONB NOT NULL DEFAULT '{}',
  status          TEXT DEFAULT 'submitted',  -- submitted, under_review, approved, declined
  reviewed_by     UUID REFERENCES public.profiles(id),
  reviewed_at     TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SMS TEMPLATES
-- ============================================================

CREATE TABLE public.sms_templates (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  body        TEXT NOT NULL,
  category    TEXT,
  created_by  UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_contacts_assigned ON public.contacts(assigned_to);
CREATE INDEX idx_contacts_stage ON public.deals(stage);
CREATE INDEX idx_contacts_source ON public.contacts(lead_source);
CREATE INDEX idx_contacts_created ON public.contacts(created_at DESC);
CREATE INDEX idx_deals_contact ON public.deals(contact_id);
CREATE INDEX idx_deals_assigned ON public.deals(assigned_to);
CREATE INDEX idx_deals_stage ON public.deals(stage);
CREATE INDEX idx_tasks_assigned ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_due ON public.tasks(due_date);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_comms_contact ON public.communications(contact_id, created_at DESC);
CREATE INDEX idx_docs_deal ON public.documents(deal_id);
CREATE INDEX idx_docs_contact ON public.documents(contact_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_ad_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

-- Staff see everything (owner/lo/processor/marketing)
CREATE POLICY "staff_all" ON public.contacts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role != 'read_only')
  );

CREATE POLICY "staff_all_deals" ON public.deals
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "staff_all_tasks" ON public.tasks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "staff_all_comms" ON public.communications
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "staff_all_docs" ON public.documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "profiles_own" ON public.profiles
  FOR ALL USING (id = auth.uid());

CREATE POLICY "staff_read_profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
  );

-- Borrower portal: contacts can see their own data
CREATE POLICY "portal_own_docs" ON public.documents
  FOR SELECT USING (
    contact_id IN (
      SELECT id FROM public.contacts WHERE portal_user_id = auth.uid()
    )
  );

-- ============================================================
-- TRIGGERS — updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contacts_updated BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_deals_updated BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SEED: Default SMS Templates
-- ============================================================

INSERT INTO public.sms_templates (name, body, category) VALUES
  ('New Lead Response', 'Hey {{first_name}}! This is {{agent_name}} from Asset Lift Lending. I saw you were looking into financing — I''d love to connect and see how I can help. When''s a good time to chat?', 'lead_response'),
  ('Missed Call Follow-Up', 'Hey {{first_name}}, I just tried to reach you! Give me a call back at {{phone}} or reply here — happy to answer any questions about your loan.', 'missed_call'),
  ('Document Reminder', 'Hi {{first_name}}, just a friendly reminder that we''re still waiting on your {{doc_name}}. Once we have it, we can keep moving on your {{loan_type}} loan. Need help? Just reply!', 'document_reminder'),
  ('Appointment Reminder', 'Hi {{first_name}}! Reminder: we have a call scheduled for {{date}} at {{time}}. Looking forward to it! — Asset Lift Lending', 'appointment'),
  ('Dead Lead Re-Engage 60d', 'Hey {{first_name}}! It''s been a while — are you still looking to fund your next deal? Rates have been looking great lately. Let''s connect!', 'reengagement'),
  ('Funded Congratulations', 'Congrats {{first_name}}! 🎉 Your loan just funded! It was a pleasure working with you. If you have any friends or investors looking for financing, I''d love the referral!', 'funded');

-- ============================================================
-- SEED: Default Automations
-- ============================================================

INSERT INTO public.automations (name, description, trigger_type, trigger_config, actions, is_active) VALUES
(
  'Instant New Lead Response',
  'Send text + email within 30 seconds of a new lead entering the system',
  'lead_created',
  '{}',
  '[
    {"type": "send_sms", "template": "new_lead_response", "delay_minutes": 0},
    {"type": "send_email", "template": "new_lead_welcome", "delay_minutes": 1},
    {"type": "create_task", "title": "Call new lead {{contact_name}}", "priority": "high", "due_in_hours": 1}
  ]',
  true
),
(
  'Follow-Up Sequence — Just Searching',
  'Long-term nurture drip every 14 days for leads not yet ready',
  'stage_changed',
  '{"to_stage": "just_searching"}',
  '[
    {"type": "send_sms", "template": "nurture_check_in", "delay_days": 14},
    {"type": "send_sms", "template": "nurture_check_in", "delay_days": 28},
    {"type": "send_email", "template": "nurture_market_update", "delay_days": 42},
    {"type": "create_task", "title": "Personal call — {{contact_name}} (nurture)", "delay_days": 30}
  ]',
  true
),
(
  'Dead Lead Re-Engagement',
  'Auto re-engage dead leads at 60 and 90 days',
  'no_contact_60d',
  '{}',
  '[
    {"type": "send_sms", "template": "dead_lead_reengage_60d"},
    {"type": "create_task", "title": "Re-engage dead lead: {{contact_name}}", "priority": "low"}
  ]',
  true
),
(
  'Deal In Progress — Task Creation',
  'Auto-create doc checklist tasks when deal moves to in_progress',
  'stage_changed',
  '{"to_stage": "in_progress"}',
  '[
    {"type": "create_task", "title": "Collect: Government ID from {{contact_name}}", "priority": "high", "due_in_days": 3},
    {"type": "create_task", "title": "Collect: LLC Documents from {{contact_name}}", "priority": "high", "due_in_days": 3},
    {"type": "create_task", "title": "Collect: Purchase Contract from {{contact_name}}", "priority": "high", "due_in_days": 3},
    {"type": "create_task", "title": "Collect: Bank Statement from {{contact_name}}", "priority": "medium", "due_in_days": 5},
    {"type": "send_email", "template": "document_checklist", "delay_minutes": 0}
  ]',
  true
),
(
  'Document Reminder Drip',
  'Remind borrowers about missing documents on days 1, 3, 7',
  'stage_changed',
  '{"to_stage": "in_progress"}',
  '[
    {"type": "send_sms", "template": "document_reminder", "delay_days": 1},
    {"type": "send_sms", "template": "document_reminder", "delay_days": 3},
    {"type": "send_email", "template": "document_reminder", "delay_days": 7}
  ]',
  true
),
(
  'Funded Loan — Referral Request',
  'Request referral after loan closes',
  'deal_funded',
  '{}',
  '[
    {"type": "send_sms", "template": "funded_congratulations", "delay_hours": 2},
    {"type": "send_email", "template": "funded_referral_request", "delay_days": 3},
    {"type": "create_task", "title": "Personal thank-you call to {{contact_name}}", "priority": "medium", "due_in_days": 1}
  ]',
  true
);

-- ============================================================
-- SEED: Default Email Templates
-- ============================================================

INSERT INTO public.email_templates (name, subject, html_body, category) VALUES
(
  'New Lead Welcome',
  'Thanks for your interest — Asset Lift Lending',
  '<h2>Hi {{first_name}},</h2><p>Thank you for reaching out to Asset Lift Lending! We specialize in fix & flip, DSCR, ground-up, and commercial bridge loans.</p><p>I''ll be giving you a call shortly to learn more about your project and see how we can help fund your next deal.</p><p>In the meantime, feel free to reply to this email with any questions.</p><br/><p><strong>Asset Lift Lending</strong><br/>info@assetliftlending.com</p>',
  'lead_response'
),
(
  'Document Checklist',
  'Next Steps: Documents Needed for Your Loan — Asset Lift Lending',
  '<h2>Hi {{first_name}},</h2><p>Great news — we''re moving forward with your {{loan_program}} loan! To keep things moving, we need the following documents:</p><ul><li>Government-issued ID</li><li>LLC Documents</li><li>Signed Purchase Contract</li><li>Recent Bank Statement (last 2 months)</li><li>Completed Scope of Work</li><li>REO Experience Form</li><li>Title Company Contact Info</li><li>Insurance Agent Contact Info</li></ul><p><a href="{{portal_url}}">Click here to upload documents securely →</a></p>',
  'document_request'
);
