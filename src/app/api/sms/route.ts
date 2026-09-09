import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendSms, TWILIO_PHONE } from '@/lib/twilio/client'
import { channelStatus } from '@/lib/communications/channels'

export async function POST(req: NextRequest) {
  try {
    const { contactId, to, body } = await req.json()
    if (!to || !body) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    // Say what is actually wrong. "SMS failed" on an unconfigured account sends
    // the user hunting for a bug that is really a missing credential.
    const sms = channelStatus().find((c) => c.key === 'sms')!
    if (!sms.configured) {
      return NextResponse.json(
        {
          error: `SMS is not connected. Add ${sms.missing.join(', ')} to your environment.`,
          code: 'channel_not_configured',
          missing: sms.missing,
        },
        { status: 503 }
      )
    }

    const msg = await sendSms(to, body)

    const supabase = createAdminClient()
    await supabase.from('communications').insert({
      contact_id:  contactId,
      type:        'sms',
      direction:   'outbound',
      body,
      status:      msg.status,
      from_number: TWILIO_PHONE,
      to_number:   to,
      twilio_sid:  msg.sid,
    })

    return NextResponse.json({ sid: msg.sid })
  } catch (err) {
    console.error('POST /api/sms', err)
    const message = err instanceof Error ? err.message : 'SMS failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
