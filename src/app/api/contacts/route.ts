import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { triggerAutomations } from '@/lib/automations/engine'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const supabase = createAdminClient()
    const toNumber = (value: unknown) => {
      if (value === null || value === undefined || value === '') return null
      const parsed = Number(String(value).replace(/[^0-9.-]/g, ''))
      return Number.isFinite(parsed) ? parsed : null
    }

    const fullName = String(body.name || '').trim()
    const [fallbackFirst, ...fallbackLastParts] = fullName.split(/\s+/).filter(Boolean)
    const firstName = String(body.first_name || fallbackFirst || '').trim()
    const lastName = String(body.last_name || fallbackLastParts.join(' ') || 'Unknown').trim()
    const afterRepairValue = toNumber(body.after_repair_value ?? body.arv)
    const experienceLevel = body.experience_level || body.experience || null
    const propertyAddress = body.property_address || body.address || null

    // Create contact
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .insert({
        first_name:   firstName,
        last_name:    lastName,
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
        credit_score: toNumber(body.credit_score),
        experience_count: toNumber(body.experience_count) ?? 0,
        entity_name: body.entity_name || null,
        entity_type: body.entity_type || null,
        stage: 'new_lead',
      })
      .select()
      .single()

    if (contactError) throw contactError

    let deal = null

    // Create deal if requested
    if (body.create_deal !== false) {
      const { data: createdDeal, error: dealError } = await supabase.from('deals').insert({
        contact_id:       contact.id,
        loan_program:     body.loan_program || 'fix_flip',
        stage:            'new_lead',
        title:            propertyAddress ? `${propertyAddress} - ${body.loan_program || 'Loan'}` : `${firstName} ${lastName} - ${body.loan_program || 'Loan'}`,
        property_address: propertyAddress,
        property_city:    body.property_city || body.city || null,
        property_state:   body.property_state || body.state || null,
        property_zip:     body.property_zip || body.zip || null,
        property_type:    body.property_type || null,
        purchase_price:   toNumber(body.purchase_price),
        rehab_amount:     toNumber(body.rehab_amount),
        loan_amount:      toNumber(body.loan_amount),
        arv:              afterRepairValue,
        after_repair_value: afterRepairValue,
        credit_score:     toNumber(body.credit_score),
        experience:       experienceLevel,
        experience_level: experienceLevel,
        under_contract:   Boolean(body.under_contract),
        exit_strategy:    body.exit_strategy || null,
        occupancy:        body.occupancy || null,
        close_date_target: body.close_date_target || null,
        notes:            body.notes || null,
        lead_source:      body.lead_source || 'direct',
        assigned_to:      body.assigned_to || null,
        submitted_by:     body.submitted_by || 'admin',
      }).select().single()

      if (dealError) throw dealError
      deal = createdDeal
    }

    // The lead is already saved. An automation failure (e.g. Twilio or SendGrid
    // not configured) must not fail the request — a 500 here makes the caller
    // retry and create duplicate leads.
    let automation_error: string | null = null
    try {
      await triggerAutomations(supabase, {
        trigger_type: 'lead_created',
        contact_id: contact.id,
        deal_id: deal?.id,
        event_key: `lead-created:${contact.id}`,
      })
    } catch (err) {
      automation_error = err instanceof Error ? err.message : 'Automation failed'
      console.error('POST /api/contacts: automations failed for contact', contact.id, err)
    }

    return NextResponse.json({ ...contact, deal, automation_error })
  } catch (err) {
    console.error('POST /api/contacts', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
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
