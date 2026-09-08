import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { appUrl, getBusinessNumber, getCellNumber } from '@/lib/twilio/client'
import { findContactByPhone } from '@/lib/twilio/phone'
import { readTwilioWebhook, twimlResponse } from '@/lib/twilio/verify'

export const dynamic = 'force-dynamic'

const RING_SECONDS = 25

/**
 * Inbound calls to the business number: log the call, ring the cell with a
 * whisper announcing the caller, and fall through to voicemail on no answer.
 */
export async function POST(req: NextRequest) {
  const { params, verified, reason } = await readTwilioWebhook(req)

  if (!verified) {
    console.error(`Twilio voice webhook rejected (${reason})`)
    return twimlResponse('<Response><Say>This call could not be verified.</Say><Hangup/></Response>')
  }

  const from = params.From ?? ''
  const to = params.To ?? getBusinessNumber() ?? ''
  const callSid = params.CallSid ?? ''
  const cell = getCellNumber()

  const supabase = createAdminClient()
  const contact = await findContactByPhone(supabase, from)

  await supabase.from('communications').insert({
    contact_id:      contact?.id ?? null,
    organization_id: contact?.organization_id ?? null,
    type:            'call',
    direction:       'inbound',
    status:          'ringing',
    from_number:     from,
    to_number:       to,
    twilio_sid:      callSid,
  })

  if (!cell) {
    // Nowhere to forward — take a message rather than dropping the lead.
    return twimlResponse(
      `<Response>
  <Say voice="Polly.Joanna">Thanks for calling Asset Lift Lending. No one is available right now, so please leave a message after the tone.</Say>
  <Record maxLength="120" playBeep="true" transcribe="true"
          transcribeCallback="${appUrl('/api/webhooks/twilio/voicemail')}"
          recordingStatusCallback="${appUrl('/api/webhooks/twilio/recording')}"/>
  <Hangup/>
</Response>`
    )
  }

  const whisperParams = new URLSearchParams({ from })
  if (contact) {
    whisperParams.set('name', [contact.first_name, contact.last_name].filter(Boolean).join(' '))
  }

  return twimlResponse(
    `<Response>
  <Dial timeout="${RING_SECONDS}" answerOnBridge="true" callerId="${to}"
        action="${appUrl('/api/webhooks/twilio/voice-complete')}" method="POST"
        record="record-from-answer-dual"
        recordingStatusCallback="${appUrl('/api/webhooks/twilio/recording')}"
        recordingStatusCallbackMethod="POST">
    <Number url="${appUrl(`/api/calls/whisper?${whisperParams.toString()}`)}" method="POST">${cell}</Number>
  </Dial>
</Response>`
  )
}
