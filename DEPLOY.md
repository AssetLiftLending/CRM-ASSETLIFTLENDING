# Asset Lift Lending CRM — Deployment Guide

Complete step-by-step setup from zero to live at **crm.assetliftlending.com**.

---

## 1. Supabase Setup (Database + Auth + Storage)

1. Go to [supabase.com](https://supabase.com) → **New Project**
   - Name: `assetlift-crm`
   - Region: pick closest to you (US East recommended)
   - Generate a strong database password — save it

2. Once created, go to **SQL Editor** and run these files in order:
   - `supabase/schema.sql`
   - `supabase/schema-additions.sql`
   - `supabase/schema-seo.sql`
   - `supabase/schema-multitenant-auth.sql`
   - This creates all tables, auth roles, RLS policies, tenant controls, automations, and seed data

3. **Storage bucket** → Create bucket named `documents` → set it to **Public** (so file URLs work)

4. **Authentication** → Settings:
   - Site URL: `https://crm.assetliftlending.com`
   - Redirect URLs: add `https://crm.assetliftlending.com/**` and `https://crm.assetliftlending.com/portal/**`
   - Enable Email provider

5. Copy your credentials:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)

6. **Create your admin users**: Authentication → Users → Invite User → each admin email
   - After you sign in, go to SQL Editor and run:
   ```sql
   UPDATE profiles
   SET role = 'platform_admin', is_active = true
   WHERE email = 'info@assetliftlending.com';

   UPDATE profiles
   SET role = 'organization_admin', is_active = true
   WHERE email = 'YOUR_ORG_ADMIN_EMAIL_HERE';
   ```
   - Platform admin can access all organizations.
   - Organization admin can access all records and uploaded documents inside their organization.

---

## 2. Twilio Setup (Calls + SMS + WhatsApp)

1. Log in to [twilio.com](https://twilio.com)
2. **Account SID** + **Auth Token** → from your Twilio dashboard
3. **Buy/port your business number** (if not already there)
4. **Configure your number** → Messaging webhooks:
   - Inbound SMS URL: `https://crm.assetliftlending.com/api/webhooks/twilio/sms`
5. **Voice webhooks**:
   - Call comes in → `https://crm.assetliftlending.com/api/calls/twiml`
   - Recording complete → `https://crm.assetliftlending.com/api/webhooks/twilio/recording`
6. **WhatsApp Sandbox or Business** → connect your WhatsApp Business number in Twilio
7. Fill in `.env.local`:
   ```
   TWILIO_ACCOUNT_SID=ACxxxxxx
   TWILIO_AUTH_TOKEN=xxxxxx
   TWILIO_PHONE_NUMBER=+15551234567
   TWILIO_CELL_NUMBER=+15557654321   # your personal cell
   TWILIO_WHATSAPP_NUMBER=whatsapp:+15551234567
   ```

---

## 3. SendGrid Setup (Email)

1. Go to [sendgrid.com](https://sendgrid.com) → Create account
2. **Settings → API Keys** → Create API Key → Full Access
3. **Sender Authentication** → Verify your `info@assetliftlending.com` domain
4. Fill in `.env.local`:
   ```
   SENDGRID_API_KEY=SG.xxxxxx
   SENDGRID_FROM_EMAIL=info@assetliftlending.com
   SENDGRID_FROM_NAME=Asset Lift Lending
   ```

---

## 4. OpenAI & Anthropic (AI Features)

1. **OpenAI**: [platform.openai.com](https://platform.openai.com) → API Keys → Create key
   ```
   OPENAI_API_KEY=sk-xxxxxx
   ```
2. **Anthropic**: [console.anthropic.com](https://console.anthropic.com) → API Keys
   ```
   ANTHROPIC_API_KEY=sk-ant-xxxxxx
   ```

---

## 5. Stripe (Appraisal Payments)

1. Go to [stripe.com](https://stripe.com) → Developers → API Keys
2. Use **Publishable key** and **Secret key**
   ```
   STRIPE_SECRET_KEY=sk_live_xxxxxx
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxx
   ```
3. For webhooks (optional, to auto-mark appraisals paid):
   - Stripe → Webhooks → Add endpoint: `https://crm.assetliftlending.com/api/webhooks/stripe`
   - Events: `checkout.session.completed`
   ```
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxx
   ```

---

## 6. Meta Ads (Facebook/Instagram Lead Ads)

1. Go to [developers.facebook.com](https://developers.facebook.com) → Create App → Business
2. Add **Webhooks** product → Subscribe to `leadgen` field on your Page
   - Callback URL: `https://crm.assetliftlending.com/api/webhooks/meta/leads`
   - Verify Token: any secret string you choose
3. **Generate Long-Lived Access Token** via Graph API Explorer
   ```
   META_ACCESS_TOKEN=EAAxxxxxx
   META_VERIFY_TOKEN=your_secret_token
   META_AD_ACCOUNT_ID=act_xxxxxx
   META_PAGE_ID=xxxxxx
   ```

---

## 7. Google Ads + Google Calendar

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → New Project
2. Enable: **Google Ads API**, **Google Calendar API**
3. OAuth 2.0 Credentials → Web Application
   - Redirect URI: `https://crm.assetliftlending.com/api/auth/google/callback`
4. Generate refresh token using OAuth Playground
   ```
   GOOGLE_CLIENT_ID=xxxxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxx
   GOOGLE_REFRESH_TOKEN=1//xxxxxx
   GOOGLE_ADS_DEVELOPER_TOKEN=xxxxxx
   GOOGLE_ADS_CUSTOMER_ID=xxxxxx
   ```

---

## 8. Vercel Deployment

1. Push this project to GitHub:
   ```bash
   cd assetlift-crm
   git init
   git add .
   git commit -m "Initial commit — Asset Lift CRM"
   git remote add origin https://github.com/YOUR_USERNAME/assetlift-crm.git
   git push -u origin main
   ```

2. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub → select `assetlift-crm`

3. **Environment Variables** → Add all variables from your `.env.local`:
   - Copy every line from `.env.local` (fill in real values first)
   - Paste into Vercel's env var UI

4. **Deploy** → wait ~2 minutes

5. **Custom Domain**:
   - Vercel → Project → Settings → Domains → Add `crm.assetliftlending.com`
   - In your DNS provider (wherever assetliftlending.com is registered), add:
     - Type: `CNAME`, Name: `crm`, Value: `cname.vercel-dns.com`
   - SSL is automatic

---

## 9. First Login

1. Visit `https://crm.assetliftlending.com/login`
2. Sign in with `info@assetliftlending.com` (you were invited via Supabase in step 1.6)
3. Set your password on first login

---

## 10. Import GHL Contacts

1. In GHL: Contacts → Export → CSV (All Contacts)
2. In CRM: Sidebar → **Import / Admin** → Upload CSV
3. All contacts, tags, pipeline stages, and notes are mapped automatically
4. After verifying import: cancel your GHL + Gennie Rocket subscriptions

---

## Monthly Cost Estimate

| Service          | Cost/month  |
|------------------|-------------|
| Supabase (Pro)   | $25         |
| Vercel (Pro)     | $20         |
| Twilio (usage)   | ~$10–30     |
| SendGrid (Essentials) | $19.95 |
| OpenAI           | ~$5–20      |
| Anthropic        | ~$5–15      |
| Stripe           | 2.9% + $0.30/transaction |
| **Total**        | **~$85–130/month** |

vs. GoHighLevel + Gennie Rocket: typically **$297–497/month**

---

## Support & Maintenance

- **Logs**: Vercel → Project → Functions tab → click any route
- **Database**: Supabase → Table Editor (view/edit any data)
- **Users**: Supabase → Authentication → Users
- **Storage**: Supabase → Storage → documents bucket
