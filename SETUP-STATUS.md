# Setup status — where the CRM stands

Working notes for finishing setup. Last updated 9 Sep 2026.

Live at **https://assetlift-crm.vercel.app** (`main` auto-deploys via Vercel).
`crm.assetliftlending.com` is not in DNS yet.

---

## Done

- **Email sending** works through SendGrid, with delivery/open/click tracking and
  inbound reply capture. Settings → Email has a live connection check and a test send.
- **Phone** — inbound calls forward to the cell with a whisper, fall through to
  voicemail, and auto-text the caller back on a miss. Click-to-call rings the agent
  first. All Twilio webhooks verify their signature. Settings → Phone & SMS checks
  credentials and sends a test text.
- **Merge tags** (`{{first_name}}`) resolve on every send path — composer, send
  routes, and delayed automations.
- **App URL** resolves from Vercel's production domain when `NEXT_PUBLIC_APP_URL`
  is unset.
- **Document checklist** takes per-deal additions, visible to the borrower.
- **Appraisal fee** can be taken by keying a card (Stripe Elements — card data
  never touches this server) or by sending a payment link.
- **New Lead form** requires only first name, phone and email.
- **CSV import** handles quoted commas, CRLF and varied header spellings.
  Re-importing repairs names that came in blank or as "Unknown".
- **GHL history importer** built (`/api/import/ghl`, panel on Import / Admin).

---

## Remaining setup

### 1. Database migrations

Run in the Supabase SQL Editor. All are safe to re-run.

| File | Needed for |
|---|---|
| `supabase/schema-communications.sql` | Delivery tracking, inbound caller matching |
| `supabase/schema-doc-requirements.sql` | Per-deal document requests |
| `supabase/schema-ghl-import.sql` | GHL history import (idempotency) |

### 2. Environment variables (Vercel → Settings → Environment Variables)

Redeploy after saving — saving alone does not rebuild.

| Variable | Needed for | Set? |
|---|---|---|
| `SENDGRID_API_KEY` | Sending email | yes |
| `SENDGRID_WEBHOOK_PUBLIC_KEY` | Open/click/bounce tracking | check |
| `SENDGRID_INBOUND_SECRET` | Capturing replies | check |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | Calls and texts | check |
| `TWILIO_PHONE_NUMBER` | Business line, E.164 (`+1…`) | check |
| `TWILIO_CELL_NUMBER` | Phone that rings on inbound calls | check |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Keyed card entry (`pk_live_…`) | no |
| `GHL_API_TOKEN` / `GHL_LOCATION_ID` | GHL history import | no |

### 3. SendGrid domain authentication — blocks inbox delivery

DNS check on 8 Sep found **no SendGrid DKIM records** on `assetliftlending.com`,
and DMARC is `p=quarantine`. Until Sender Authentication is verified in SendGrid,
mail sent as `info@assetliftlending.com` is filtered to spam.

Root MX is Google Workspace (`smtp.google.com`) — **do not touch MX records.**
Inbound Parse goes on the `reply.` subdomain only.

### 4. Twilio number

Buy the new number, then set both webhooks (HTTP POST):

- A call comes in → `https://assetlift-crm.vercel.app/api/webhooks/twilio/voice`
- A message comes in → `https://assetlift-crm.vercel.app/api/webhooks/twilio/sms`

US texting also needs A2P 10DLC brand + campaign registration; carriers filter
unregistered traffic. Voice works without it.

The number on the website is still in GoHighLevel — forward it or port it, and
**do not cancel GHL until a port completes** or the number is lost.

---

## GHL history import

Panel on **Import / Admin**. Contacts must be imported first: history attaches to
existing contacts and never creates them.

1. **Check connection** — verifies the token and reports the conversation count.
2. **Preview first 20** — reads only, writes nothing.
3. **Import everything** — batches of 20, resumable.

**Unverified against real data.** GHL returns message types as a number on some
locations and a string like `TYPE_SMS` on others; both are handled and anything
unrecognised is filed as a note. The preview exists to check the real shape before
committing — if types or dates look wrong there, adjust `mapMessageType` in
`src/lib/ghl/import.ts`. Version headers are in `src/lib/ghl/client.ts` and are
overridable via `GHL_API_VERSION`.

Recordings import as links to GHL's storage, which die when the account closes.
Copying the files across is not built.

---

## Notes for future sessions

- `AGENTS.md` claims this is a modified Next.js and points at
  `node_modules/next/dist/docs/` and a generator script. **Neither exists.** This is
  plain Next.js 14.2.4. The file is misleading and can be deleted.
- `/api/reports` has no `export const dynamic = 'force-dynamic'`, so Vercel
  evaluates it during the build. It works, but a slow database at build time
  would fail a deploy.
- The broker portal keeps its own document checklist, separate from the deal and
  borrower ones.
- Broker and borrower signup forms still require a property address; the CRM's own
  New Lead form does not.
