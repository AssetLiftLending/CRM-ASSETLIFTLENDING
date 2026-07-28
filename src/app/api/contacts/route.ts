import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendSms } from '@/lib/twilio/client'
import { sendEmail, interpolateEmail } from '@/lib/sendgrid/client'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const supabase = createAdminClient()

    // Create contact
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .insert({
        first_name:   body.first_name,
        last_name:    body.last_name,
        email:        body.email || null,
        phone:        body.phone || null,
        cell_phone:   body.cell_phone || null,
        whatsapp:     body.whatsapp || null,
        address:      body.address || null,
        city:         body.city || null,
        state:        body.state || null,
        zip:          body.zip || null,
        lead_source:  body.lead_source || 'direct',
        assigned_to:  body.assigned_to || null,
        lead_source_detail: body.lead_source_detail || null,
      })
      .select()
      .single()

    if (contactError) throw contactError

    // Create deal if requested
    if (body.create_deal !== false) {
      await supabase.from('deals').insert({
        contact_id:       contact.id,
        loan_program:     body.loan_program || 'fix_flip',
        stage:            'new_inquiry',
        property_address: body.property_address || null,
        purchase_price:   body.purchase_price ? parseInt(body.purchase_price) : null,
        rehab_amount:     body.rehab_amount   ? parseInt(body.rehab_amount)   : null,
        loan_amount:      body.loan_amount    ? parseInt(body.loan_amount)    : null,
        lead_source:      body.lead_source || 'direct',
        assigned_to:      body.assigned_to || null,
      })
    }

    // Trigger lead_created automations (fire and forget)
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/automations/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger_type: 'lead_created', contact_id: contact.id }),
    }).catch(() => {})

    return NextResponse.json(contact)
  } catch (err) {
    console.error('POST /api/contacts', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')

  let query = supabase
    .from('contacts')
    .select('id, first_name, last_name, email, phone, lead_source, created_at')
    .eq('is_archived', false)
    .order('created_at', { ascending: false })
    .limit(100)

  if (q) {
    query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
