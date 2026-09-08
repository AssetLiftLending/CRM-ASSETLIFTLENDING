import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { canSendCommunications, getStaffContext } from '@/lib/auth/session'
import { formatTwilioError, getBusinessNumber, isTwilioConfigured, startClickToCall } from '@/lib/twilio/client'
import { toE164 } from '@/lib/twilio/phone'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const staff = await getStaffContext()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canSendCommunications(staff.role)) {
    return NextResponse.json({ error: 'Your role cannot place calls.' }, { status: 403 })
  }
  if (!isTwilioConfigured()) {
    return NextResponse.json(
      { error: 'Phone is not configured yet. Add your Twilio credentials, then check Settings → Phone & SMS.' },
      { status: 503 }
    )
  }

  let payload: { contactId?: string; dealId?: string; to?: string }
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
      .select('id, first_name, last_name, phone, cell_phone, organization_id')
      .eq('id', payload.contactId)
      .single()
    contact = data ?? null
  }

  const target = toE164(payload.to ?? contact?.phone ?? contact?.cell_phone)
  if (!target) {
    return NextResponse.json({ error: 'No valid phone number for this contact.' }, { status: 400 })
  }

  try {
    const call = await startClickToCall({
      contactNumber: target,
      agentNumber: staff.phone,
      contactName: [contact?.first_name, contact?.last_name].filter(Boolean).join(' '),
    })

    await supabase.from('communications').insert({
      contact_id:      contact?.id ?? null,
      deal_id:         payload.dealId ?? null,
      organization_id: contact?.organization_id ?? staff.organizationId ?? null,
      type:            'call',
      direction:       'outbound',
      status:          'initiated',
      user_id:         staff.userId,
      from_number:     getBusinessNumber(),
      to_number:       target,
      twilio_sid:      call.sid,
    })

    return NextResponse.json({ sid: call.sid, status: call.status, to: target })
  } catch (err) {
    const message = formatTwilioError(err)
    console.error('POST /api/calls', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
