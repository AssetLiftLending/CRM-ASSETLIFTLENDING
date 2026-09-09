import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/sendgrid/client'
import { channelStatus } from '@/lib/communications/channels'

export async function POST(req: NextRequest) {
  try {
    const { contactId, to, subject, html, text } = await req.json()
    if (!to || !subject || !html) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const email = channelStatus().find((c) => c.key === 'email')!
    if (!email.configured) {
      return NextResponse.json(
        {
          error: `Email is not connected. Add ${email.missing.join(', ')} to your environment.`,
          code: 'channel_not_configured',
          missing: email.missing,
        },
        { status: 503 }
      )
    }

    const result = await sendEmail({ to, subject, html, text })

    const supabase = createAdminClient()
    await supabase.from('communications').insert({
      contact_id: contactId,
      type:       'email',
      direction:  'outbound',
      subject,
      body:       html,
      snippet:    html.replace(/<[^>]+>/g, '').slice(0, 200),
      status:     'sent',
      sendgrid_id: result.messageId,
      from_email: process.env.SENDGRID_FROM_EMAIL,
      to_email:   to,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('POST /api/email', err)
    const message = err instanceof Error ? err.message : 'Email failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
