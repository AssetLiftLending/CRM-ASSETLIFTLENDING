import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { appUrl, formatTwilioError, getBusinessNumber, missedCallAutoText } from '@/lib/twilio/client'
import { findContactByPhone } from '@/lib/twilio/phone'
import { readTwilioWebhook, twimlResponse } from '@/lib/twilio/verify'

export const dynamic = 'force-dynamic'

const MISSED_STATUSES = ['no-answer', 'busy', 'failed', 'canceled']

/**
 * Runs after the forwarding <Dial> ends. If the agent picked up we hang up
 * cleanly; otherwise we take a voicemail and text the caller back.
 */
export async function POST(req: NextRequest) {
  const { params, verified } = await readTwilioWebhook(req)
  if (!verified) return twimlResponse('<Response><Hangup/></Response>')

  const dialStatus = params.DialCallStatus ?? ''
  const callSid = params.CallSid ?? ''
  const from = params.From ?? ''
  const duration = parseInt(params.DialCallDuration ?? '0', 10) || 0

  const supabase = createAdminClient()

  if (dialStatus === 'completed') {
    await supabase
      .from('communications')
      .update({ status: 'completed', duration_secs: duration })
      .eq('twilio_sid', callSid)

    return twimlResponse('<Response><Hangup/></Response>')
  }

  if (MISSED_STATUSES.includes(dialStatus)) {
    await supabase
      .from('communications')
      .update({ status: 'missed', voicemail: true })
      .eq('twilio_sid', callSid)

    // Text the caller back immediately — the single highest-value follow-up.
    if (from && from !== getBusinessNumber()) {
      const contact = await findContactByPhone(supabase, from)
      try {
        const sms = await missedCallAutoText(from)
        await supabase.from('communications').insert({
          contact_id:      contact?.id ?? null,
          organization_id: contact?.organization_id ?? null,
          type:            'sms',
          direction:       'outbound',
          body:            sms.body,
          snippet:         sms.body?.slice(0, 200),
          status:          sms.status,
          from_number:     getBusinessNumber(),
          to_number:       from,
          twilio_sid:      sms.sid,
        })
      } catch (err) {
        console.error('Missed-call auto-text failed', formatTwilioError(err))
      }
    }
  }

  return twimlResponse(
    `<Response>
  <Say voice="Polly.Joanna">Sorry we missed you. Please leave your name, number, and a quick note about your deal after the tone, and we'll call you right back.</Say>
  <Record maxLength="120" playBeep="true" transcribe="true"
          transcribeCallback="${appUrl('/api/webhooks/twilio/voicemail')}"
          recordingStatusCallback="${appUrl('/api/webhooks/twilio/recording')}"
          recordingStatusCallbackMethod="POST"/>
  <Say voice="Polly.Joanna">Thanks. Goodbye.</Say>
  <Hangup/>
</Response>`
  )
}
