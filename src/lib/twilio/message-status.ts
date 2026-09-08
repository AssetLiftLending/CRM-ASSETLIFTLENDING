import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { readTwilioWebhook } from '@/lib/twilio/verify'

// A delivered receipt must not be undone by a late "sent" callback.
const RANK: Record<string, number> = {
  queued: 1, accepted: 1, scheduled: 1, sending: 2, sent: 3,
  delivered: 4, read: 5, undelivered: 6, failed: 6,
}

/** Shared handler for Twilio SMS and WhatsApp delivery receipts. */
export async function handleMessageStatus(req: NextRequest) {
  const { params, verified } = await readTwilioWebhook(req)
  if (!verified) return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })

  const sid = params.MessageSid ?? params.SmsSid ?? ''
  const status = params.MessageStatus ?? params.SmsStatus ?? ''
  const errorCode = params.ErrorCode ?? ''
  if (!sid || !status) return NextResponse.json({ ok: true })

  const supabase = createAdminClient()
  const { data: comm } = await supabase
    .from('communications')
    .select('id, status')
    .eq('twilio_sid', sid)
    .maybeSingle()

  if (!comm) return NextResponse.json({ ok: true, matched: false })
  if ((RANK[status] ?? 0) < (RANK[comm.status ?? ''] ?? 0)) {
    return NextResponse.json({ ok: true, matched: true, skipped: true })
  }

  const patch: Record<string, unknown> = { status }
  if (errorCode) patch.ai_summary = `Delivery failed (Twilio error ${errorCode})`

  await supabase.from('communications').update(patch).eq('id', comm.id)
  return NextResponse.json({ ok: true, matched: true })
}
