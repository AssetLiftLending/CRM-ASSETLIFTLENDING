import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/sendgrid/client'

export async function POST(req: NextRequest) {
  try {
    const { contactId, to, subject, html, text } = await req.json()
    if (!to || !subject || !html) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    await sendEmail({ to, subject, html, text })

    const supabase = createAdminClient()
    await supabase.from('communications').insert({
      contact_id: contactId,
      type:       'email',
      direction:  'outbound',
      subject,
      body:       html,
      snippet:    html.replace(/<[^>]+>/g, '').slice(0, 200),
      status:     'sent',
      from_email: process.env.SENDGRID_FROM_EMAIL,
      to_email:   to,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('POST /api/email', err)
    return NextResponse.json({ error: 'Email failed' }, { status: 500 })
  }
}
