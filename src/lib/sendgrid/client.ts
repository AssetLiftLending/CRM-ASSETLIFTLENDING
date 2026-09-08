import sgMail from '@sendgrid/mail'

const SENDGRID_API = 'https://api.sendgrid.com/v3'

let configuredKey: string | null = null

export function getSendGridApiKey() {
  return process.env.SENDGRID_API_KEY?.trim() || ''
}

export function isSendGridConfigured() {
  return getSendGridApiKey().startsWith('SG.')
}

function getSendGridClient() {
  const apiKey = getSendGridApiKey()
  if (!apiKey.startsWith('SG.')) {
    throw new Error('SENDGRID_API_KEY is missing or malformed (it must start with "SG.").')
  }
  // Re-configure when the key changes (env reloads between deploys/tests).
  if (configuredKey !== apiKey) {
    sgMail.setApiKey(apiKey)
    configuredKey = apiKey
  }
  return sgMail
}

export function getFromAddress() {
  return {
    email: process.env.SENDGRID_FROM_EMAIL?.trim() || 'info@assetliftlending.com',
    name:  process.env.SENDGRID_FROM_NAME?.trim()  || 'Asset Lift Lending',
  }
}

// ── HELPERS ────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function isValidEmail(email?: string | null): email is string {
  return typeof email === 'string' && EMAIL_RE.test(email.trim())
}

/** Accepts a string, a comma/semicolon separated list, or an array. Returns validated addresses. */
export function parseRecipients(to: string | string[] | undefined | null): string[] {
  const raw = Array.isArray(to) ? to : String(to ?? '').split(/[,;]/)
  const cleaned = raw.map((r) => r.trim()).filter(Boolean)
  const invalid = cleaned.filter((r) => !isValidEmail(r))
  if (invalid.length) throw new Error(`Invalid email address: ${invalid.join(', ')}`)
  return Array.from(new Set(cleaned.map((r) => r.toLowerCase())))
}

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
}

/** Plain-text fallback so messages do not land in spam for missing text/plain part. */
export function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;/g, (m) => ENTITIES[m] ?? m)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** SendGrid buries the useful part of a failure in response.body.errors — surface it. */
export function formatSendGridError(err: unknown) {
  const anyErr = err as { message?: string; code?: number; response?: { body?: { errors?: Array<{ message?: string; field?: string }> } } }
  const errors = anyErr?.response?.body?.errors
  if (Array.isArray(errors) && errors.length) {
    return errors.map((e) => (e.field ? `${e.field}: ${e.message}` : e.message)).filter(Boolean).join('; ')
  }
  if (anyErr?.message) return anyErr.message
  return 'Unknown SendGrid error'
}

// ── SINGLE EMAIL ───────────────────────────────────────────

export interface SendEmailResult {
  messageId: string | null
  statusCode: number
  to: string[]
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
  cc,
  bcc,
  categories,
  customArgs,
}: {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
  cc?: string | string[]
  bcc?: string | string[]
  categories?: string[]
  customArgs?: Record<string, string>
}): Promise<SendEmailResult> {
  const recipients = parseRecipients(to)
  if (!recipients.length) throw new Error('At least one recipient is required.')
  if (!subject?.trim()) throw new Error('Subject is required.')
  if (!html?.trim()) throw new Error('Message body is required.')

  const from = getFromAddress()

  const [response] = await getSendGridClient().send({
    to: recipients,
    from,
    subject,
    html,
    text: text?.trim() || htmlToText(html),
    replyTo: replyTo && isValidEmail(replyTo) ? replyTo : from.email,
    ...(cc ? { cc: parseRecipients(cc) } : {}),
    ...(bcc ? { bcc: parseRecipients(bcc) } : {}),
    ...(categories?.length ? { categories } : {}),
    ...(customArgs && Object.keys(customArgs).length ? { customArgs } : {}),
    trackingSettings: {
      clickTracking:        { enable: true },
      openTracking:         { enable: true },
      subscriptionTracking: { enable: false },
    },
  })

  const headerId = response?.headers?.['x-message-id'] as string | undefined

  return {
    // SendGrid event webhooks report sg_message_id as "<x-message-id>.filterN..." — store the stable prefix.
    messageId: headerId ?? null,
    statusCode: response?.statusCode ?? 0,
    to: recipients,
  }
}

// ── BULK CAMPAIGN ──────────────────────────────────────────

export async function sendCampaign({
  recipients,
  subject,
  html,
  fromName,
  fromEmail,
  categories,
}: {
  recipients: Array<{ email: string; name?: string; substitutions?: Record<string, string> }>
  subject: string
  html: string
  fromName?: string
  fromEmail?: string
  categories?: string[]
}) {
  const valid = recipients.filter((r) => isValidEmail(r.email))
  if (!valid.length) throw new Error('No valid recipients in this campaign.')

  const from = getFromAddress()
  // SendGrid caps a single request at 1000 personalizations.
  const batches: Array<typeof valid> = []
  for (let i = 0; i < valid.length; i += 1000) batches.push(valid.slice(i, i + 1000))

  const results = []
  for (const batch of batches) {
    const [response] = await getSendGridClient().send({
      from: { email: fromEmail ?? from.email, name: fromName ?? from.name },
      subject,
      html,
      text: htmlToText(html),
      personalizations: batch.map((r) => ({
        to: [{ email: r.email, name: r.name }],
        substitutions: r.substitutions ?? {},
      })),
      ...(categories?.length ? { categories } : {}),
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking:  { enable: true },
      },
    } as Parameters<typeof sgMail.send>[0])

    results.push({
      messageId: (response?.headers?.['x-message-id'] as string | undefined) ?? null,
      statusCode: response?.statusCode ?? 0,
      count: batch.length,
    })
  }

  return { batches: results, sent: valid.length, skipped: recipients.length - valid.length }
}

// ── TEMPLATE EMAIL ─────────────────────────────────────────

export function interpolateEmail(html: string, vars: Record<string, string>) {
  return html.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? '')
}

// ── DIAGNOSTICS ────────────────────────────────────────────

export interface SendGridStatus {
  configured: boolean
  keyValid: boolean
  fromEmail: string
  fromName: string
  senderVerified: boolean | null
  inboundConfigured: boolean
  eventWebhookConfigured: boolean
  message: string
}

/** Live check used by Settings → Email so misconfiguration is visible before a send fails. */
export async function checkSendGridConnection(): Promise<SendGridStatus> {
  const from = getFromAddress()
  const base: SendGridStatus = {
    configured: isSendGridConfigured(),
    keyValid: false,
    fromEmail: from.email,
    fromName: from.name,
    senderVerified: null,
    inboundConfigured: Boolean(process.env.SENDGRID_INBOUND_SECRET),
    eventWebhookConfigured: Boolean(process.env.SENDGRID_WEBHOOK_PUBLIC_KEY),
    message: '',
  }

  if (!base.configured) {
    return { ...base, message: 'SENDGRID_API_KEY is not set (it must start with "SG.").' }
  }

  try {
    const res = await fetch(`${SENDGRID_API}/scopes`, {
      headers: { Authorization: `Bearer ${getSendGridApiKey()}` },
      cache: 'no-store',
    })
    if (!res.ok) {
      return { ...base, message: `SendGrid rejected the API key (HTTP ${res.status}). Create a new key with Mail Send access.` }
    }
    base.keyValid = true
  } catch (err) {
    return { ...base, message: `Could not reach SendGrid: ${formatSendGridError(err)}` }
  }

  // Domain authentication is what actually keeps mail out of spam.
  try {
    const domain = from.email.split('@')[1]
    const res = await fetch(`${SENDGRID_API}/whitelabel/domains?limit=100`, {
      headers: { Authorization: `Bearer ${getSendGridApiKey()}` },
      cache: 'no-store',
    })
    if (res.ok) {
      const domains = (await res.json()) as Array<{ domain?: string; valid?: boolean }>
      const match = Array.isArray(domains) ? domains.find((d) => d.domain === domain) : undefined
      base.senderVerified = match ? Boolean(match.valid) : false
    }
  } catch {
    // Key may lack whitelabel read scope — sending still works, so leave as unknown.
  }

  base.message = base.senderVerified === false
    ? `API key works. Domain "${from.email.split('@')[1]}" is not authenticated in SendGrid — mail may land in spam.`
    : 'SendGrid is connected and ready to send.'

  return base
}
