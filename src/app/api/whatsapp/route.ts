import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendWhatsApp } from '@/lib/twilio/client'
import { channelStatus } from '@/lib/communications/channels'

export async function POST(req: NextRequest) {
  try {
    const { contactId, to, body } = await req.json()
    if (!to || !body) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const wa = channelStatus().find((c) => c.key === 'whatsapp')!
    if (!wa.configured) {
      return NextResponse.json(
        {
          error: `WhatsApp is not connected. Add ${wa.missing.join(', ')} to your environment.`,
          code: 'channel_not_configured',
          missing: wa.missing,
        },
        { status: 503 }
      )
    }

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
    const message = err instanceof Error ? err.message : 'WhatsApp failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
