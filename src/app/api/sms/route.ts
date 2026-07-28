import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendSms, TWILIO_PHONE } from '@/lib/twilio/client'

export async function POST(req: NextRequest) {
  try {
    const { contactId, to, body } = await req.json()
    if (!to || !body) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

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
    return NextResponse.json({ error: 'SMS failed' }, { status: 500 })
  }
}
