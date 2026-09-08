import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { readTwilioWebhook } from '@/lib/twilio/verify'

export const dynamic = 'force-dynamic'

// A completed call must not be reopened by a late "ringing" callback.
const RANK: Record<string, number> = {
  queued: 1, initiated: 1, ringing: 2, 'in-progress': 3, answered: 3,
  completed: 4, missed: 4, busy: 4, 'no-answer': 4, failed: 4, canceled: 4, voicemail: 5,
}

export async function POST(req: NextRequest) {
  const { params, verified } = await readTwilioWebhook(req)
  if (!verified) return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })

  const callSid = params.CallSid ?? ''
  const status = params.CallStatus ?? ''
  const duration = parseInt(params.CallDuration ?? '0', 10) || 0
  if (!callSid || !status) return NextResponse.json({ ok: true })

  const supabase = createAdminClient()
  const { data: comm } = await supabase
    .from('communications')
    .select('id, status, duration_secs')
    .eq('twilio_sid', callSid)
    .maybeSingle()

  if (!comm) return NextResponse.json({ ok: true, matched: false })

  const patch: Record<string, unknown> = {}
  if ((RANK[status] ?? 0) >= (RANK[comm.status ?? ''] ?? 0)) patch.status = status
  if (duration && !comm.duration_secs) patch.duration_secs = duration

  if (Object.keys(patch).length) {
    await supabase.from('communications').update(patch).eq('id', comm.id)
  }

  return NextResponse.json({ ok: true, matched: true })
}
