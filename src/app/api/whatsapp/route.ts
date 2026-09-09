import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { canSendCommunications, getStaffContext } from '@/lib/auth/session'
import { formatTwilioError, getWhatsAppNumber, sendWhatsApp } from '@/lib/twilio/client'
import { toE164 } from '@/lib/twilio/phone'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const staff = await getStaffContext()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canSendCommunications(staff.role)) {
    return NextResponse.json({ error: 'Your role cannot send WhatsApp messages.' }, { status: 403 })
  }
  if (!getWhatsAppNumber()) {
    return NextResponse.json(
      { error: 'WhatsApp is not configured. Set TWILIO_WHATSAPP_NUMBER to your Twilio WhatsApp sender.' },
      { status: 503 }
    )
  }

  let payload: { contactId?: string; dealId?: string; to?: string; body?: string }
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const supabase = createAdminClient()

  let contact: Record<string, any> | null = null
  if (payload.contactId) {
    const { data } = await supabase
      .from('contacts')
      .select('id, whatsapp, cell_phone, phone, organization_id')
      .eq('id', payload.contactId)
      .single()
    contact = data ?? null
  }

  const target = toE164(payload.to ?? contact?.whatsapp ?? contact?.cell_phone)
  const body = payload.body?.trim() ?? ''
  if (!target) return NextResponse.json({ error: 'No valid WhatsApp number for this contact.' }, { status: 400 })
  if (!body) return NextResponse.json({ error: 'Message body is required.' }, { status: 400 })

  try {
    const msg = await sendWhatsApp(target, body)

    await supabase.from('communications').insert({
      contact_id:      contact?.id ?? null,
      deal_id:         payload.dealId ?? null,
      organization_id: contact?.organization_id ?? staff.organizationId ?? null,
      type:            'whatsapp',
      direction:       'outbound',
      body,
      snippet:         body.slice(0, 200),
      status:          msg.status,
      user_id:         staff.userId,
      from_number:     getWhatsAppNumber(),
      to_number:       target,
      twilio_sid:      msg.sid,
    })

    return NextResponse.json({ sid: msg.sid, status: msg.status, to: target })
  } catch (err) {
    const message = formatTwilioError(err)
    console.error('POST /api/whatsapp', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
