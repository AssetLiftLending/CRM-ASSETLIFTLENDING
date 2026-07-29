import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

const STAFF_ROLES = ['platform_admin', 'organization_admin', 'owner', 'loan_officer', 'processor', 'marketing']

function clean(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function contactSummary(companyName: string | null, contactName: string | null, phone: string | null, email: string | null) {
  return [
    companyName && `Company: ${companyName}`,
    contactName && `Contact: ${contactName}`,
    phone && `Phone: ${phone}`,
    email && `Email: ${email}`,
  ].filter(Boolean).join('\n') || null
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const authClient = createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !STAFF_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { data: deal } = await admin
    .from('deals')
    .select('id, contact_id')
    .eq('id', params.id)
    .single()

  if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

  const titleCompanyName = clean(body.title_company_name)
  const titleContactName = clean(body.title_company_contact_name)
  const titlePhone = clean(body.title_company_phone)
  const titleEmail = clean(body.title_company_email)
  const insuranceName = clean(body.insurance_agent_name)
  const insuranceContactName = clean(body.insurance_agent_contact_name)
  const insurancePhone = clean(body.insurance_agent_phone)
  const insuranceEmail = clean(body.insurance_agent_email)
  const ssn = clean(body.ssn)

  const dealUpdate = {
    title_company_name: titleCompanyName || titleContactName,
    title_company_phone: titlePhone,
    title_company_email: titleEmail,
    title_company_contact: contactSummary(titleCompanyName, titleContactName, titlePhone, titleEmail),
    insurance_agent_name: insuranceName || insuranceContactName,
    insurance_agent_phone: insurancePhone,
    insurance_agent_email: insuranceEmail,
    insurance_agent_contact: contactSummary(insuranceName, insuranceContactName, insurancePhone, insuranceEmail),
    updated_at: new Date().toISOString(),
  }

  const { error: dealError } = await admin
    .from('deals')
    .update(dealUpdate)
    .eq('id', params.id)

  if (dealError) return NextResponse.json({ error: dealError.message }, { status: 500 })

  if (ssn) {
    const { error: contactError } = await admin
      .from('contacts')
      .update({ ssn_encrypted: ssn, updated_at: new Date().toISOString() })
      .eq('id', deal.contact_id)

    if (contactError) return NextResponse.json({ error: contactError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
