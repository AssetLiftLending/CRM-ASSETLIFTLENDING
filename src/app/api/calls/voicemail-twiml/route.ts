import { NextRequest } from 'next/server'
import { escapeXml, readTwilioWebhook, twimlResponse } from '@/lib/twilio/verify'

export const dynamic = 'force-dynamic'

/** Plays a pre-recorded voicemail drop, then hangs up. */
export async function POST(req: NextRequest) {
  const { verified } = await readTwilioWebhook(req)
  if (!verified) {
    return twimlResponse('<Response><Hangup/></Response>')
  }

  const url = req.nextUrl.searchParams.get('url')
  if (!url || !/^https:\/\//.test(url)) {
    return twimlResponse('<Response><Hangup/></Response>')
  }

  return twimlResponse(
    `<Response>
  <Pause length="1"/>
  <Play>${escapeXml(url)}</Play>
  <Hangup/>
</Response>`
  )
}
