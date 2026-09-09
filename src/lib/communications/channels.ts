// Server-side only: reads private credentials. Call it from server components
// and route handlers, and pass the resulting booleans to the client — never
// import this into a 'use client' module.

export type ChannelKey = 'sms' | 'call' | 'whatsapp' | 'email'

export interface ChannelStatus {
  key: ChannelKey
  label: string
  configured: boolean
  /** The address messages go out from, when the channel is usable. */
  detail: string
  /** Env vars that still need values, in the order a person should set them. */
  missing: string[]
}

function need(vars: string[]): string[] {
  return vars.filter((name) => !process.env[name])
}

/**
 * Which outbound channels can actually send right now.
 *
 * The inbox reads this instead of asserting that everything is connected: a
 * composer that offers SMS when Twilio has no credentials produces a failed
 * send and no explanation of why.
 */
export function channelStatus(): ChannelStatus[] {
  const twilio = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN']

  const smsMissing = need([...twilio, 'TWILIO_PHONE_NUMBER'])
  const callMissing = need([...twilio, 'TWILIO_PHONE_NUMBER', 'NEXT_PUBLIC_APP_URL'])
  const waMissing = need([...twilio, 'TWILIO_WHATSAPP_NUMBER'])
  const emailMissing = need(['SENDGRID_API_KEY', 'SENDGRID_FROM_EMAIL'])

  return [
    {
      key: 'sms',
      label: 'SMS',
      configured: smsMissing.length === 0,
      detail: process.env.TWILIO_PHONE_NUMBER ?? '',
      missing: smsMissing,
    },
    {
      key: 'call',
      label: 'Calling',
      configured: callMissing.length === 0,
      detail: process.env.TWILIO_PHONE_NUMBER ?? '',
      missing: callMissing,
    },
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      configured: waMissing.length === 0,
      detail: process.env.TWILIO_WHATSAPP_NUMBER ?? '',
      missing: waMissing,
    },
    {
      key: 'email',
      label: 'Email',
      configured: emailMissing.length === 0,
      detail: process.env.SENDGRID_FROM_EMAIL ?? '',
      missing: emailMissing,
    },
  ]
}
