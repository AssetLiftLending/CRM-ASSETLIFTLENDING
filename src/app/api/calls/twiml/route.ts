import { NextRequest } from 'next/server'
import { appUrl, getBusinessNumber } from '@/lib/twilio/client'
import { toE164 } from '@/lib/twilio/phone'
import { escapeXml, readTwilioWebhook, twimlResponse } from '@/lib/twilio/verify'

export const dynamic = 'force-dynamic'

/**
 * Runs on the agent leg of a click-to-call: the agent has answered, so bridge
 * them to the contact from the business number and record the conversation.
 */
export async function POST(req: NextRequest) {
  const { verified } = await readTwilioWebhook(req)
  if (!verified) {
    return twimlResponse('<Response><Say>This call could not be verified.</Say><Hangup/></Response>')
  }

  const to = toE164(req.nextUrl.searchParams.get('to'))
  const name = req.nextUrl.searchParams.get('name')?.trim()
  const callerId = getBusinessNumber()

  if (!to || !callerId) {
    return twimlResponse('<Response><Say>The number for this call is not available.</Say><Hangup/></Response>')
  }

  const greeting = name
    ? `Connecting you to ${escapeXml(name)}.`
    : 'Connecting your call.'

  return twimlResponse(
    `<Response>
  <Say voice="Polly.Joanna">${greeting}</Say>
  <Dial callerId="${callerId}" timeout="30" answerOnBridge="true"
        record="record-from-answer-dual"
        recordingStatusCallback="${appUrl('/api/webhooks/twilio/recording')}"
        recordingStatusCallbackMethod="POST">
    <Number>${to}</Number>
  </Dial>
</Response>`
  )
}
