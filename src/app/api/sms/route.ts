import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { canSendCommunications, getStaffContext } from '@/lib/auth/session'
import { buildMergeVars } from '@/lib/communications/merge'
import { formatTwilioError, getBusinessNumber, interpolate, isTwilioConfigured, sendSms } from '@/lib/twilio/client'
import { toE164 } from '@/lib/twilio/phone'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const staff = await getStaffContext()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canSendCommunications(staff.role)) {
    return NextResponse.json({ error: 'Your role cannot send texts.' }, { status: 403 })
  }
  if (!isTwilioConfigured()) {
    return NextResponse.json(
      { error: 'Texting is not configured yet. Add your Twilio credentials, then check Settings → Phone & SMS.' },
      { status: 503 }
    )
  }

  let payload: { contactId?: string; dealId?: string; to?: string; body?: string; templateId?: string }
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
      .select('id, first_name, last_name, email, phone, cell_phone, city, state, entity_name, organization_id')
      .eq('id', payload.contactId)
      .single()
    contact = data ?? null
  }

  let body = payload.body?.trim() ?? ''
  if (payload.templateId) {
    const { data: template } = await supabase
      .from('sms_templates')
      .select('body')
      .eq('id', payload.templateId)
      .single()
    if (!template) return NextResponse.json({ error: 'SMS template not found' }, { status: 404 })
    body = body || template.body
  }
  body = interpolate(body, buildMergeVars(contact, staff))

  const target = toE164(payload.to ?? contact?.cell_phone ?? contact?.phone)
  if (!target) return NextResponse.json({ error: 'No valid mobile number for this contact.' }, { status: 400 })
  if (!body) return NextResponse.json({ error: 'Message body is required.' }, { status: 400 })

  try {
    const msg = await sendSms(target, body)

    const { data: comm } = await supabase
      .from('communications')
      .insert({
        contact_id:      contact?.id ?? null,
        deal_id:         payload.dealId ?? null,
        organization_id: contact?.organization_id ?? staff.organizationId ?? null,
        type:            'sms',
        direction:       'outbound',
        body,
        snippet:         body.slice(0, 200),
        status:          msg.status,
        user_id:         staff.userId,
        from_number:     getBusinessNumber(),
        to_number:       target,
        twilio_sid:      msg.sid,
      })
      .select('id')
      .single()

    return NextResponse.json({ sid: msg.sid, status: msg.status, to: target, communicationId: comm?.id ?? null })
  } catch (err) {
    const message = formatTwilioError(err)
    console.error('POST /api/sms', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
