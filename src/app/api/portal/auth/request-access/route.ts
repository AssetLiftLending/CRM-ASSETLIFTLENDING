import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/sendgrid/client'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    const supabase = createAdminClient()

    // Check if contact exists
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, first_name')
      .eq('email', email)
      .single()

    // Send magic link via Supabase Auth
    const { error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/portal`,
      },
    })

    if (error) {
      // Fall back to just notifying the lender
      await sendEmail({
        to: 'info@assetliftlending.com',
        subject: `Portal Access Request: ${email}`,
        text: `${email} is requesting access to the borrower portal. Please invite them via Supabase Auth.`,
        html: `<p><strong>${email}</strong> is requesting access to the borrower portal. Please invite them via the Supabase dashboard.</p>`,
      })
      return NextResponse.json({ ok: true })
    }

    // Also notify lender
    if (contact) {
      await sendEmail({
        to: email,
        subject: 'Access Your Asset Lift Lending Portal',
        text: `Hi ${contact.first_name}, click the link below to access your loan portal.`,
        html: `<h2>Hi ${contact.first_name}!</h2><p>Click below to access your Asset Lift Lending borrower portal and track your loan application.</p>`,
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Request access error:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
