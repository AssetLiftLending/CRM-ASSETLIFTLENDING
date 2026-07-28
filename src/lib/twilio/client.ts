import twilio from 'twilio'

export const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

export const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER!
export const TWILIO_CELL  = process.env.TWILIO_CELL_NUMBER!
export const TWILIO_WA    = process.env.TWILIO_WHATSAPP_NUMBER!

// ── CALLS ──────────────────────────────────────────────────

export async function makeCall(to: string, from = TWILIO_PHONE) {
  return twilioClient.calls.create({
    to,
    from,
    url: `${process.env.NEXT_PUBLIC_APP_URL}/api/calls/twiml`,
    statusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/call-status`,
    statusCallbackMethod: 'POST',
    record: true,
    recordingStatusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/recording`,
  })
}

export async function forwardToCell(to: string) {
  return makeCall(to, TWILIO_CELL)
}

// ── SMS ────────────────────────────────────────────────────

export async function sendSms(to: string, body: string, from = TWILIO_PHONE) {
  return twilioClient.messages.create({
    to,
    from,
    body,
    statusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/sms-status`,
  })
}

// ── WHATSAPP ───────────────────────────────────────────────

export async function sendWhatsApp(to: string, body: string) {
  return twilioClient.messages.create({
    to: `whatsapp:${to}`,
    from: TWILIO_WA,
    body,
    statusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/wa-status`,
  })
}

export async function sendWhatsAppTemplate(
  to: string,
  templateSid: string,
  variables: Record<string, string>
) {
  return twilioClient.messages.create({
    to: `whatsapp:${to}`,
    from: TWILIO_WA,
    contentSid: templateSid,
    contentVariables: JSON.stringify(variables),
  })
}

// ── VOICEMAIL DROP ─────────────────────────────────────────

export async function dropVoicemail(to: string, voicemailUrl: string) {
  return twilioClient.calls.create({
    to,
    from: TWILIO_PHONE,
    url: `${process.env.NEXT_PUBLIC_APP_URL}/api/calls/voicemail-twiml?url=${encodeURIComponent(voicemailUrl)}`,
    machineDetection: 'DetectMessageEnd',
  })
}

// ── MISSED CALL AUTO-TEXT ──────────────────────────────────

export async function missedCallAutoText(to: string, agentName: string) {
  const body = `Hey! This is ${agentName} from Asset Lift Lending — I just tried to reach you! Give me a call back at ${TWILIO_PHONE.replace('+1', '')} or reply here. Happy to chat about your next deal 🏠`
  return sendSms(to, body)
}

// ── TEMPLATE INTERPOLATION ────────────────────────────────

export function interpolate(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}
