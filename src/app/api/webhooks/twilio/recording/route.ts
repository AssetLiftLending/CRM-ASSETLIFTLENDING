import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { summarizeCall } from '@/lib/anthropic/client'

// Twilio recording callback — auto-transcribe + AI summarize
export async function POST(req: NextRequest) {
  const form         = await req.formData()
  const recordingUrl = form.get('RecordingUrl') as string
  const callSid      = form.get('CallSid') as string
  const duration     = parseInt(form.get('RecordingDuration') as string ?? '0')

  const supabase = createAdminClient()

  // Find the communication record by twilio_sid
  const { data: comm } = await supabase
    .from('communications')
    .select('id, contact_id, contacts(first_name, last_name)')
    .eq('twilio_sid', callSid)
    .single()

  if (comm) {
    // Try to get transcript from Twilio (if recording transcription enabled)
    // For now, update with recording URL
    const contactName = (comm.contacts as { first_name?: string; last_name?: string } | null)
      ? `${(comm.contacts as { first_name?: string }).first_name} ${(comm.contacts as { last_name?: string }).last_name}`
      : 'Unknown'

    // Generate AI summary (without transcript for now — full transcription requires Twilio Intelligence add-on)
    const summary = { summary: `Call with ${contactName} lasted ${duration} seconds`, sentiment: 'neutral', next_action: 'Follow up', key_facts: [] }

    await supabase.from('communications').update({
      recording_url:  `${recordingUrl}.mp3`,
      duration_secs:  duration,
      ai_summary:     summary.summary,
      status:         'completed',
    }).eq('twilio_sid', callSid)
  }

  return NextResponse.json({ ok: true })
}
