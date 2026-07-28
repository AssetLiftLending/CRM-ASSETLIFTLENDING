import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/sendgrid/client'

// GET — broker fetches their own deals
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: deals } = await admin
    .from('deals')
    .select(`
      *,
      contacts (id, first_name, last_name, email, phone),
      documents (id, doc_type, status, created_at)
    `)
    .eq('broker_id', user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ deals: deals ?? [] })
}

// POST — broker submits a new deal for a client
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Verify broker is approved
  const { data: profile } = await admin.from('profiles').select('role, approved, full_name, company_name').eq('id', user.id).single()
  if (!profile || profile.role !== 'broker' || !profile.approved) {
    return NextResponse.json({ error: 'Broker account not approved' }, { status: 403 })
  }

  const body = await req.json()

  // Upsert contact (by email)
  let contactId: string
  const { data: existing } = await admin.from('contacts').select('id').eq('email', body.borrower_email).maybeSingle()
  if (existing) {
    contactId = existing.id
  } else {
    const { data: newContact } = await admin.from('contacts').insert({
      first_name: body.borrower_first_name,
      last_name: body.borrower_last_name,
      email: body.borrower_email,
      phone: body.borrower_phone || null,
      lead_source: 'broker',
      stage: 'new_inquiry',
    }).select().single()
    contactId = newContact!.id

    // Link broker → client
    await admin.from('broker_clients').upsert({
      broker_id: user.id,
      contact_id: contactId,
    })
  }

  // Create deal
  const { data: deal } = await admin.from('deals').insert({
    contact_id: contactId,
    broker_id: user.id,
    submitted_by: 'broker',
    loan_program: body.loan_program,
    property_address: body.property_address,
    purchase_price: body.purchase_price ? Number(body.purchase_price) : null,
    rehab_amount: body.rehab_amount ? Number(body.rehab_amount) : null,
    arv: body.arv ? Number(body.arv) : null,
    loan_amount: body.loan_amount ? Number(body.loan_amount) : null,
    experience: body.experience || null,
    notes: body.notes || null,
    stage: 'new_inquiry',
  }).select().single()

  // Notify lender
  try {
    await sendEmail({
      to: 'info@assetliftlending.com',
      subject: `New Broker Deal — ${body.borrower_first_name} ${body.borrower_last_name} via ${profile.company_name || profile.full_name}`,
      html: `
        <h2>New Deal Submitted by Broker</h2>
        <p><strong>Broker:</strong> ${profile.full_name} (${profile.company_name})</p>
        <hr/>
        <p><strong>Borrower:</strong> ${body.borrower_first_name} ${body.borrower_last_name}</p>
        <p><strong>Email:</strong> ${body.borrower_email}</p>
        <p><strong>Phone:</strong> ${body.borrower_phone || 'N/A'}</p>
        <hr/>
        <p><strong>Loan Program:</strong> ${body.loan_program}</p>
        <p><strong>Property:</strong> ${body.property_address}</p>
        <p><strong>Purchase Price:</strong> $${Number(body.purchase_price || 0).toLocaleString()}</p>
        <p><strong>Rehab:</strong> $${Number(body.rehab_amount || 0).toLocaleString()}</p>
        <p><strong>ARV:</strong> $${Number(body.arv || 0).toLocaleString()}</p>
        <p><strong>Loan Amount Requested:</strong> $${Number(body.loan_amount || 0).toLocaleString()}</p>
        <br/>
        <a href="https://crm.assetliftlending.com/deals/${deal!.id}" style="background:#D4A017;color:#000;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">View Deal in CRM →</a>
      `,
    })
  } catch (e) {
    console.error('Email failed:', e)
  }

  return NextResponse.json({ success: true, dealId: deal!.id })
}
