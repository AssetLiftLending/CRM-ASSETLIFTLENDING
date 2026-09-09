import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { findContactByPhone } from '@/lib/twilio/phone'
import { readTwilioWebhook, twimlResponse } from '@/lib/twilio/verify'

export const dynamic = 'force-dynamic'

const EMPTY_TWIML = '<Response></Response>'

/** Inbound SMS and MMS to the business number. */
export async function POST(req: NextRequest) {
  const { params, verified, reason } = await readTwilioWebhook(req)

  if (!verified) {
    console.error(`Twilio SMS webhook rejected (${reason})`)
    return twimlResponse(EMPTY_TWIML)
  }

  const from = params.From ?? ''
  const to = params.To ?? ''
  const body = params.Body ?? ''
  const sid = params.MessageSid ?? params.SmsSid ?? ''
  const mediaCount = parseInt(params.NumMedia ?? '0', 10) || 0

  if (!from) return twimlResponse(EMPTY_TWIML)

  const supabase = createAdminClient()
  const contact = await findContactByPhone(supabase, from)

  const text = mediaCount > 0 && !body ? `[${mediaCount} attachment${mediaCount > 1 ? 's' : ''}]` : body

  const { error } = await supabase.from('communications').insert({
    contact_id:      contact?.id ?? null,
    organization_id: contact?.organization_id ?? null,
    type:            'sms',
    direction:       'inbound',
    body:            text,
    snippet:         text.slice(0, 200),
    status:          'received',
    from_number:     from,
    to_number:       to,
    twilio_sid:      sid,
  })

  if (error) console.error('Twilio SMS webhook — insert failed', error)

  // Empty TwiML: log the message without auto-replying.
  return twimlResponse(EMPTY_TWIML)
}
