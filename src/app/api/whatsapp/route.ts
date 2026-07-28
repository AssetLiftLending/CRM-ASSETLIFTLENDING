import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendWhatsApp } from '@/lib/twilio/client'

export async function POST(req: NextRequest) {
  try {
    const { contactId, to, body } = await req.json()
    if (!to || !body) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const msg = await sendWhatsApp(to, body)

    const supabase = createAdminClient()
    await supabase.from('communications').insert({
      contact_id: contactId,
      type:       'whatsapp',
      direction:  'outbound',
      body,
      status:     msg.status,
      to_number:  to,
      twilio_sid: msg.sid,
    })

    return NextResponse.json({ sid: msg.sid })
  } catch (err) {
    console.error('POST /api/whatsapp', err)
    return NextResponse.json({ error: 'WhatsApp failed' }, { status: 500 })
  }
}
