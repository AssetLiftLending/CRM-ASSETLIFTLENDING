import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { readTwilioWebhook } from '@/lib/twilio/verify'

export const dynamic = 'force-dynamic'

/** Twilio recording callback — attaches the recording to the logged call. */
export async function POST(req: NextRequest) {
  const { params, verified } = await readTwilioWebhook(req)
  if (!verified) return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })

  const recordingUrl = params.RecordingUrl ?? ''
  const callSid = params.CallSid ?? ''
  const duration = parseInt(params.RecordingDuration ?? '0', 10) || 0

  if (!callSid || !recordingUrl) return NextResponse.json({ ok: true })

  const supabase = createAdminClient()
  const { data: comm } = await supabase
    .from('communications')
    .select('id, duration_secs')
    .eq('twilio_sid', callSid)
    .maybeSingle()

  if (!comm) return NextResponse.json({ ok: true, matched: false })

  await supabase
    .from('communications')
    .update({
      recording_url: `${recordingUrl}.mp3`,
      duration_secs: comm.duration_secs || duration,
    })
    .eq('id', comm.id)

  return NextResponse.json({ ok: true, matched: true })
}
