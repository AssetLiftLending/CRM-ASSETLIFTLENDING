-- ============================================================
-- Asset Lift Lending CRM — SEO & Marketing AI Schema
-- Run in Supabase SQL Editor after schema.sql and schema-additions.sql
-- ============================================================

-- 1. Websites tracked for SEO
CREATE TABLE IF NOT EXISTS websites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,                        -- "Asset Lift Lending"
  url             TEXT NOT NULL,                        -- "https://assetliftlending.com"
  industry        TEXT,                                 -- "Hard Money Lending"
  location        TEXT,                                 -- "New York, NY"
  target_audience TEXT,                                 -- "Real estate investors, fix & flip"
  competitors     TEXT[],                               -- ['competitor1.com', 'competitor2.com']
  primary_keywords TEXT[],                              -- seed keywords from user
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. SEO audits
CREATE TABLE IF NOT EXISTS seo_audits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id  UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  score       INTEGER,                   -- 0-100
  audit_data  JSONB NOT NULL,            -- full AI analysis
  raw_html    TEXT,                      -- truncated crawled HTML
  status      TEXT DEFAULT 'completed'   -- pending / completed / failed
);

-- 3. Generated content
CREATE TABLE IF NOT EXISTS generated_content (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id  UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  type        TEXT NOT NULL CHECK (type IN (
    'blog_post','social_instagram','social_facebook','social_linkedin',
    'social_twitter','email_newsletter','email_sequence',
    'google_ad','meta_ad','meta_tags','keyword_research',
    'competitor_analysis','content_calendar'
  )),
  title       TEXT,
  content     TEXT NOT NULL,
  metadata    JSONB,                     -- keywords used, target audience, etc.
  status      TEXT DEFAULT 'draft' CHECK (status IN ('draft','approved','published','archived')),
  published_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ
);

-- 4. Keyword tracking
CREATE TABLE IF NOT EXISTS tracked_keywords (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id  UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  keyword     TEXT NOT NULL,
  intent      TEXT,                      -- informational / commercial / transactional / navigational
  difficulty  INTEGER,                   -- 0-100
  volume_est  TEXT,                      -- "1K-10K/mo"
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(website_id, keyword)
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_seo_audits_website    ON seo_audits(website_id);
CREATE INDEX IF NOT EXISTS idx_gen_content_website   ON generated_content(website_id);
CREATE INDEX IF NOT EXISTS idx_gen_content_type      ON generated_content(type);
CREATE INDEX IF NOT EXISTS idx_tracked_kw_website    ON tracked_keywords(website_id);

-- 6. RLS
ALTER TABLE websites          ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_audits        ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracked_keywords  ENABLE ROW LEVEL SECURITY;

-- Admins only (internal tool)
CREATE POLICY websites_admin ON websites
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

CREATE POLICY seo_audits_admin ON seo_audits
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

CREATE POLICY gen_content_admin ON generated_content
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

CREATE POLICY tracked_kw_admin ON tracked_keywords
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

-- 7. Seed: add assetliftlending.com as first website
INSERT INTO websites (name, url, industry, location, target_audience, primary_keywords, competitors)
VALUES (
  'Asset Lift Lending',
  'https://assetliftlending.com',
  'Hard Money / Private Lending',
  'New York, NY',
  'Real estate investors, fix & flip buyers, rental property investors, commercial borrowers',
  ARRAY['hard money lender', 'fix and flip loans', 'DSCR loans', 'private money lender', 'bridge loans', 'real estate investment loans'],
  ARRAY['lendingone.com', 'kiavicapital.com', 'roc360.com']
) ON CONFLICT DO NOTHING;
