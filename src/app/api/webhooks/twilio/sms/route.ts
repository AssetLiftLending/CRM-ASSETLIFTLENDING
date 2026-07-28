import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Twilio inbound SMS webhook
export async function POST(req: NextRequest) {
  const form   = await req.formData()
  const from   = form.get('From') as string
  const body   = form.get('Body') as string
  const sid    = form.get('MessageSid') as string

  const supabase = createAdminClient()

  // Find contact by phone number
  const phone = from.replace(/\D/g, '')
  const { data: contact } = await supabase
    .from('contacts')
    .select('id, first_name, last_name')
    .or(`phone.ilike.%${phone.slice(-10)}%,cell_phone.ilike.%${phone.slice(-10)}%`)
    .single()

  // Log inbound SMS
  await supabase.from('communications').insert({
    contact_id:  contact?.id ?? null,
    type:        'sms',
    direction:   'inbound',
    body,
    status:      'received',
    from_number: from,
    twilio_sid:  sid,
  })

  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    headers: { 'Content-Type': 'text/xml' },
  })
}
