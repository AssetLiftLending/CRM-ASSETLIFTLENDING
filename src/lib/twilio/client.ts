import twilio from 'twilio'
import { toE164 } from '@/lib/twilio/phone'

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  if (!accountSid || !authToken) {
    throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required for Twilio actions.')
  }
  if (!accountSid.startsWith('AC')) {
    throw new Error('TWILIO_ACCOUNT_SID looks wrong — it should start with "AC".')
  }
  return twilio(accountSid, authToken)
}

export const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER ?? ''
export const TWILIO_CELL  = process.env.TWILIO_CELL_NUMBER ?? ''
export const TWILIO_WA    = process.env.TWILIO_WHATSAPP_NUMBER ?? ''

export function getBusinessNumber() { return toE164(process.env.TWILIO_PHONE_NUMBER) }
export function getCellNumber()     { return toE164(process.env.TWILIO_CELL_NUMBER) }
export function getWhatsAppNumber() {
  const raw = process.env.TWILIO_WHATSAPP_NUMBER ?? ''
  const e164 = toE164(raw)
  return e164 ? `whatsapp:${e164}` : ''
}

export function isTwilioConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.startsWith('AC') &&
    process.env.TWILIO_AUTH_TOKEN &&
    getBusinessNumber()
  )
}

export function appUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? ''
  return `${base}${path}`
}

/** Twilio errors carry the actionable detail in `code` + `moreInfo`. */
export function formatTwilioError(err: unknown) {
  const e = err as { message?: string; code?: number; moreInfo?: string; status?: number }
  if (e?.code) return `${e.message ?? 'Twilio error'} (code ${e.code})`
  return e?.message ?? 'Unknown Twilio error'
}

// ── CALLS ──────────────────────────────────────────────────

/**
 * Click-to-call: ring the agent first, then bridge to the contact.
 * Dialing the contact first makes them answer to silence, which reads as spam.
 */
export async function startClickToCall({
  contactNumber,
  agentNumber,
  contactName,
}: {
  contactNumber: string
  agentNumber?: string | null
  contactName?: string
}) {
  const to = toE164(contactNumber)
  const from = getBusinessNumber()
  const agent = toE164(agentNumber) ?? getCellNumber()

  if (!to) throw new Error(`"${contactNumber}" is not a valid phone number.`)
  if (!from) throw new Error('TWILIO_PHONE_NUMBER is not set — add your business number.')
  if (!agent) throw new Error('No number to ring you on. Set your phone in Settings → Profile, or TWILIO_CELL_NUMBER.')

  const params = new URLSearchParams({ to, ...(contactName ? { name: contactName } : {}) })

  return getTwilioClient().calls.create({
    to: agent,
    from,
    url: appUrl(`/api/calls/twiml?${params.toString()}`),
    statusCallback: appUrl('/api/webhooks/twilio/call-status'),
    statusCallbackEvent: ['initiated', 'answered', 'completed'],
    statusCallbackMethod: 'POST',
  })
}

export async function forwardToCell(to: string) {
  return startClickToCall({ contactNumber: to })
}

// ── SMS ────────────────────────────────────────────────────

export async function sendSms(to: string, body: string, from?: string) {
  const toNumber = toE164(to)
  const fromNumber = toE164(from) ?? getBusinessNumber()

  if (!toNumber) throw new Error(`"${to}" is not a valid phone number.`)
  if (!fromNumber) throw new Error('TWILIO_PHONE_NUMBER is not set — add your business number.')
  if (!body?.trim()) throw new Error('Message body is required.')

  return getTwilioClient().messages.create({
    to: toNumber,
    from: fromNumber,
    body,
    statusCallback: appUrl('/api/webhooks/twilio/sms-status'),
  })
}

// ── WHATSAPP ───────────────────────────────────────────────

export async function sendWhatsApp(to: string, body: string) {
  const toNumber = toE164(to)
  const from = getWhatsAppNumber()
  if (!toNumber) throw new Error(`"${to}" is not a valid WhatsApp number.`)
  if (!from) throw new Error('TWILIO_WHATSAPP_NUMBER is not set.')

  return getTwilioClient().messages.create({
    to: `whatsapp:${toNumber}`,
    from,
    body,
    statusCallback: appUrl('/api/webhooks/twilio/wa-status'),
  })
}

export async function sendWhatsAppTemplate(
  to: string,
  templateSid: string,
  variables: Record<string, string>
) {
  const toNumber = toE164(to)
  const from = getWhatsAppNumber()
  if (!toNumber) throw new Error(`"${to}" is not a valid WhatsApp number.`)
  if (!from) throw new Error('TWILIO_WHATSAPP_NUMBER is not set.')

  return getTwilioClient().messages.create({
    to: `whatsapp:${toNumber}`,
    from,
    contentSid: templateSid,
    contentVariables: JSON.stringify(variables),
  })
}

// ── VOICEMAIL DROP ─────────────────────────────────────────

export async function dropVoicemail(to: string, voicemailUrl: string) {
  const toNumber = toE164(to)
  const from = getBusinessNumber()
  if (!toNumber) throw new Error(`"${to}" is not a valid phone number.`)
  if (!from) throw new Error('TWILIO_PHONE_NUMBER is not set.')

  return getTwilioClient().calls.create({
    to: toNumber,
    from,
    url: appUrl(`/api/calls/voicemail-twiml?url=${encodeURIComponent(voicemailUrl)}`),
    machineDetection: 'DetectMessageEnd',
    statusCallback: appUrl('/api/webhooks/twilio/call-status'),
  })
}

// ── MISSED CALL AUTO-TEXT ──────────────────────────────────

export async function missedCallAutoText(to: string, agentName = 'Asset Lift Lending') {
  const business = getBusinessNumber() ?? ''
  const display = business.replace(/^\+1/, '')
  const body = `Hey! This is ${agentName} — sorry I missed your call. Give me a ring back at ${display} or just reply here and I'll help with your deal.`
  return sendSms(to, body)
}

// ── TEMPLATE INTERPOLATION ────────────────────────────────

export function interpolate(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

// ── DIAGNOSTICS ────────────────────────────────────────────

export interface TwilioStatus {
  configured: boolean
  credentialsValid: boolean
  businessNumber: string | null
  cellNumber: string | null
  whatsappNumber: string | null
  numberOwned: boolean | null
  voiceWebhook: string | null
  smsWebhook: string | null
  webhooksMatch: boolean | null
  message: string
}

/** Live check used by Settings → Phone & SMS so bad wiring is visible before a call fails. */
export async function checkTwilioConnection(): Promise<TwilioStatus> {
  const business = getBusinessNumber()
  const status: TwilioStatus = {
    configured: isTwilioConfigured(),
    credentialsValid: false,
    businessNumber: business,
    cellNumber: getCellNumber(),
    whatsappNumber: getWhatsAppNumber() || null,
    numberOwned: null,
    voiceWebhook: null,
    smsWebhook: null,
    webhooksMatch: null,
    message: '',
  }

  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    return { ...status, message: 'TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are not set.' }
  }
  if (!business) {
    return { ...status, message: 'TWILIO_PHONE_NUMBER is not set (use E.164, e.g. +15551234567).' }
  }

  try {
    const client = getTwilioClient()
    await client.api.v2010.accounts(process.env.TWILIO_ACCOUNT_SID!.trim()).fetch()
    status.credentialsValid = true

    const numbers = await client.incomingPhoneNumbers.list({ phoneNumber: business, limit: 1 })
    const number = numbers[0]
    status.numberOwned = Boolean(number)

    if (number) {
      status.voiceWebhook = number.voiceUrl || null
      status.smsWebhook = number.smsUrl || null
      const expectedVoice = appUrl('/api/webhooks/twilio/voice')
      const expectedSms = appUrl('/api/webhooks/twilio/sms')
      status.webhooksMatch = number.voiceUrl === expectedVoice && number.smsUrl === expectedSms
      status.message = status.webhooksMatch
        ? 'Twilio is connected. Calls and texts route into the CRM.'
        : `Number is connected, but its Twilio webhooks do not point at this CRM yet. Set Voice to ${expectedVoice} and Messaging to ${expectedSms}.`
    } else {
      status.message = `${business} is not on this Twilio account. Buy or port the number, or fix TWILIO_PHONE_NUMBER.`
    }
  } catch (err) {
    return { ...status, message: `Twilio rejected the credentials: ${formatTwilioError(err)}` }
  }

  return status
}
