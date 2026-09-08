import { NextRequest } from 'next/server'
import { fmt } from '@/lib/utils/format'
import { escapeXml, readTwilioWebhook, twimlResponse } from '@/lib/twilio/verify'

export const dynamic = 'force-dynamic'

/** Played to the agent before an inbound call is bridged, so CRM calls are recognizable. */
export async function POST(req: NextRequest) {
  const { verified } = await readTwilioWebhook(req)
  if (!verified) return twimlResponse('<Response></Response>')

  const name = req.nextUrl.searchParams.get('name')?.trim()
  const from = req.nextUrl.searchParams.get('from')?.trim()
  const caller = name || (from ? fmt.phone(from) : 'an unknown number')

  return twimlResponse(
    `<Response><Say voice="Polly.Joanna">Asset Lift call from ${escapeXml(caller)}.</Say></Response>`
  )
}
