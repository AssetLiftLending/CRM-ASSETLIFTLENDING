import sgMail from '@sendgrid/mail'

sgMail.setApiKey(process.env.SENDGRID_API_KEY!)

const FROM = {
  email: process.env.SENDGRID_FROM_EMAIL ?? 'info@assetliftlending.com',
  name:  process.env.SENDGRID_FROM_NAME  ?? 'Asset Lift Lending',
}

// ── SINGLE EMAIL ───────────────────────────────────────────

export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
}: {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
}) {
  const msg = {
    to,
    from: FROM,
    subject,
    html,
    text: text ?? html.replace(/<[^>]+>/g, ''),
    replyTo: replyTo ?? FROM.email,
    trackingSettings: {
      clickTracking:    { enable: true },
      openTracking:     { enable: true },
      subscriptionTracking: { enable: true },
    },
  }
  return sgMail.send(msg)
}

// ── BULK CAMPAIGN ──────────────────────────────────────────

export async function sendCampaign({
  recipients,
  subject,
  html,
  fromName,
  fromEmail,
}: {
  recipients: Array<{ email: string; name?: string; substitutions?: Record<string, string> }>
  subject: string
  html: string
  fromName?: string
  fromEmail?: string
}) {
  const personalizations = recipients.map((r) => ({
    to: [{ email: r.email, name: r.name }],
    substitutions: r.substitutions ?? {},
  }))

  return sgMail.send({
    from: { email: fromEmail ?? FROM.email, name: fromName ?? FROM.name },
    subject,
    html,
    personalizations,
    trackingSettings: {
      clickTracking: { enable: true },
      openTracking:  { enable: true },
    },
  } as Parameters<typeof sgMail.send>[0])
}

// ── TEMPLATE EMAIL ─────────────────────────────────────────

export function interpolateEmail(html: string, vars: Record<string, string>) {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}
