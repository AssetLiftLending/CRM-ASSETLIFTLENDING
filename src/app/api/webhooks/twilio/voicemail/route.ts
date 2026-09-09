import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { readTwilioWebhook } from '@/lib/twilio/verify'

export const dynamic = 'force-dynamic'

/** Twilio transcription callback for voicemails. */
export async function POST(req: NextRequest) {
  const { params, verified } = await readTwilioWebhook(req)
  if (!verified) return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })

  const callSid = params.CallSid ?? ''
  const text = params.TranscriptionText ?? ''
  const recordingUrl = params.RecordingUrl ?? ''
  if (!callSid) return NextResponse.json({ ok: true })

  const patch: Record<string, unknown> = { voicemail: true, status: 'voicemail' }
  if (text) {
    patch.transcript = text
    patch.snippet = text.slice(0, 200)
  }
  if (recordingUrl) patch.recording_url = `${recordingUrl}.mp3`

  await createAdminClient().from('communications').update(patch).eq('twilio_sid', callSid)

  return NextResponse.json({ ok: true })
}
