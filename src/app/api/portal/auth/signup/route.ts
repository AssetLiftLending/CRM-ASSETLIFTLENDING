import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/sendgrid/client'

export async function POST(req: NextRequest) {
  const { account, deal } = await req.json()
  const supabase = createAdminClient()

  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: {
      first_name: account.first_name,
      last_name: account.last_name,
      role: 'borrower',
    },
  })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  const userId = authData.user.id

  // 2. Create profile (upsert in case trigger already created it)
  await supabase.from('profiles').upsert({
    id: userId,
    full_name: `${account.first_name} ${account.last_name}`,
    email: account.email,
    phone: account.phone || null,
    role: 'borrower',
  })

  // 3. Create contact record
  const { data: contact, error: contactError } = await supabase.from('contacts').insert({
    first_name: account.first_name,
    last_name: account.last_name,
    email: account.email,
    phone: account.phone || null,
    lead_source: 'portal',
    stage: 'new_inquiry',
  }).select().single()

  if (contactError) return NextResponse.json({ error: contactError.message }, { status: 500 })

  // 4. Create deal
  const { data: newDeal, error: dealError } = await supabase.from('deals').insert({
    contact_id: contact.id,
    loan_program: deal.loan_program,
    property_address: deal.property_address,
    purchase_price: deal.purchase_price ? Number(deal.purchase_price) : null,
    rehab_amount: deal.rehab_amount ? Number(deal.rehab_amount) : null,
    arv: deal.arv ? Number(deal.arv) : null,
    experience: deal.experience || null,
    notes: deal.notes || null,
    stage: 'new_inquiry',
    submitted_by: 'borrower',
  }).select().single()

  if (dealError) return NextResponse.json({ error: dealError.message }, { status: 500 })

  // 5. Notify lender
  try {
    await sendEmail({
      to: 'info@assetliftlending.com',
      subject: `New Loan Application — ${account.first_name} ${account.last_name}`,
      html: `
        <h2>New Borrower Application Submitted</h2>
        <p><strong>Name:</strong> ${account.first_name} ${account.last_name}</p>
        <p><strong>Email:</strong> ${account.email}</p>
        <p><strong>Phone:</strong> ${account.phone || 'N/A'}</p>
        <hr/>
        <p><strong>Loan Program:</strong> ${deal.loan_program}</p>
        <p><strong>Property:</strong> ${deal.property_address}</p>
        <p><strong>Purchase Price:</strong> $${Number(deal.purchase_price).toLocaleString()}</p>
        <p><strong>Rehab Amount:</strong> $${Number(deal.rehab_amount || 0).toLocaleString()}</p>
        <p><strong>ARV:</strong> $${Number(deal.arv || 0).toLocaleString()}</p>
        <p><strong>Experience:</strong> ${deal.experience || 'N/A'}</p>
        <p><strong>Notes:</strong> ${deal.notes || 'None'}</p>
        <br/>
        <a href="https://crm.assetliftlending.com/deals/${newDeal.id}" style="background:#D4A017;color:#000;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">View Deal in CRM →</a>
      `,
    })

    // 6. Welcome email to borrower
    await sendEmail({
      to: account.email,
      subject: 'Your Application Was Received — Asset Lift Lending',
      html: `
        <h2>Hi ${account.first_name},</h2>
        <p>Thank you for submitting your loan application to Asset Lift Lending!</p>
        <p>We've received your application for <strong>${deal.loan_program}</strong> at <strong>${deal.property_address}</strong>.</p>
        <p>Our team will review your application and reach out within 1 business day.</p>
        <p>You can log in to your borrower portal at any time to track your deal status and upload documents:</p>
        <a href="https://assetliftlending.com/portal" style="background:#D4A017;color:#000;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">View Your Portal →</a>
        <br/><br/>
        <p>Best regards,<br/>Asset Lift Lending Team<br/>info@assetliftlending.com</p>
      `,
    })
  } catch (emailErr) {
    console.error('Email notification failed:', emailErr)
  }

  return NextResponse.json({ success: true, contactId: contact.id, dealId: newDeal.id })
}
