import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { makeCall, TWILIO_PHONE } from '@/lib/twilio/client'

export async function POST(req: NextRequest) {
  try {
    const { contactId, to } = await req.json()
    if (!to) return NextResponse.json({ error: 'Phone number required' }, { status: 400 })

    // Initiate call
    const call = await makeCall(to)

    // Log the communication
    const supabase = createAdminClient()
    await supabase.from('communications').insert({
      contact_id:  contactId,
      type:        'call',
      direction:   'outbound',
      status:      'initiated',
      from_number: TWILIO_PHONE,
      to_number:   to,
      twilio_sid:  call.sid,
    })

    return NextResponse.json({ sid: call.sid, status: call.status })
  } catch (err) {
    console.error('POST /api/calls', err)
    return NextResponse.json({ error: 'Call failed' }, { status: 500 })
  }
}
