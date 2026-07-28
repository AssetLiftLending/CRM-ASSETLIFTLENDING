import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/sendgrid/client'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const supabase = createAdminClient()

  // Create auth user (NOT confirmed — needs admin approval)
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: false, // pending approval
    user_metadata: { role: 'broker' },
  })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  // Create profile as broker, not yet approved
  await supabase.from('profiles').upsert({
    id: authData.user.id,
    full_name: `${body.first_name} ${body.last_name}`,
    email: body.email,
    phone: body.phone || null,
    role: 'broker',
    company_name: body.company_name || null,
    license_number: body.license_number || null,
    approved: false,
  })

  // Notify admin
  try {
    await sendEmail({
      to: 'info@assetliftlending.com',
      subject: `New Broker Application — ${body.first_name} ${body.last_name} (${body.company_name})`,
      html: `
        <h2>New Broker Partner Application</h2>
        <p><strong>Name:</strong> ${body.first_name} ${body.last_name}</p>
        <p><strong>Company:</strong> ${body.company_name}</p>
        <p><strong>Email:</strong> ${body.email}</p>
        <p><strong>Phone:</strong> ${body.phone}</p>
        <p><strong>State:</strong> ${body.state}</p>
        <p><strong>NMLS:</strong> ${body.license_number || 'N/A'}</p>
        <p><strong>Est. Deals/Month:</strong> ${body.how_many_deals || 'N/A'}</p>
        <p><strong>Notes:</strong> ${body.notes || 'None'}</p>
        <br/>
        <p>To approve this broker, go to <strong>Admin → Brokers</strong> in your CRM:</p>
        <a href="https://crm.assetliftlending.com/admin/brokers" style="background:#D4A017;color:#000;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Manage Brokers →</a>
      `,
    })
  } catch (emailErr) {
    console.error('Email failed:', emailErr)
  }

  return NextResponse.json({ success: true })
}
