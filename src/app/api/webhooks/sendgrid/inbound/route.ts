import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/sendgrid/client'

function extractAddress(value: string) {
  return value.match(/<([^>]+)>/)?.[1]?.trim().toLowerCase() ?? value.trim().toLowerCase()
}

function isAutomatedMessage(headers: string, from: string) {
  return /auto-submitted:\s*(?!no)/i.test(headers) ||
    /precedence:\s*(bulk|junk|list)/i.test(headers) ||
    /x-autoreply|x-autorespond/i.test(headers) ||
    /mailer-daemon|postmaster/i.test(from)
}

export async function POST(req: NextRequest) {
  const expectedSecret = process.env.SENDGRID_INBOUND_WEBHOOK_SECRET
  if (!expectedSecret || req.nextUrl.searchParams.get('secret') !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const form = await req.formData()
    const fromRaw = String(form.get('from') ?? '')
    const fromEmail = extractAddress(fromRaw)
    const toEmail = extractAddress(String(form.get('to') ?? ''))
    const subject = String(form.get('subject') ?? '(no subject)')
    const text = String(form.get('text') ?? '')
    const html = String(form.get('html') ?? '')
    const headers = String(form.get('headers') ?? '')
    if (!fromEmail) return NextResponse.json({ error: 'Missing sender' }, { status: 400 })

    const supabase = createAdminClient()
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, first_name, email')
      .ilike('email', fromEmail)
      .maybeSingle()

    await supabase.from('communications').insert({
      contact_id: contact?.id ?? null,
      type: 'email',
      direction: 'inbound',
      subject,
      body: html || text,
      snippet: text.slice(0, 200),
      status: 'received',
      from_email: fromEmail,
      to_email: toEmail,
    })

    if (contact?.id) {
      await Promise.all([
        supabase.from('scheduled_automation_actions').update({
          status: 'cancelled',
          processed_at: new Date().toISOString(),
          last_error: 'Cancelled because the contact replied',
        }).eq('contact_id', contact.id).eq('status', 'pending').eq('cancel_on_reply', true),
        supabase.from('tasks').insert({
          contact_id: contact.id,
          title: `Reply to ${contact.first_name || fromEmail}: ${subject}`,
          priority: 'high',
          due_date: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        }),
      ])

      if (!isAutomatedMessage(headers, fromRaw)) {
        const acknowledgementSubject = 'We received your email - Asset Lift Lending'
        const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
        const { data: recentAcknowledgement } = await supabase
          .from('communications')
          .select('id')
          .eq('contact_id', contact.id)
          .eq('direction', 'outbound')
          .eq('subject', acknowledgementSubject)
          .gte('created_at', since)
          .limit(1)
          .maybeSingle()

        if (!recentAcknowledgement) {
          const firstName = contact.first_name ? ` ${contact.first_name}` : ''
          const message = `<p>Hi${firstName},</p><p>Thanks for your email. We received your message and a member of the Asset Lift Lending team will follow up shortly.</p><p>Asset Lift Lending<br/>info@assetliftlending.com</p>`
          const result = await sendEmail({
            to: fromEmail,
            subject: acknowledgementSubject,
            html: message,
          })
          await supabase.from('communications').insert({
            contact_id: contact.id,
            type: 'email',
            direction: 'outbound',
            subject: acknowledgementSubject,
            body: message,
            snippet: 'Thanks for your email. We received your message and will follow up shortly.',
            status: 'processed',
            sendgrid_id: result.messageId,
            from_email: process.env.SENDGRID_FROM_EMAIL,
            to_email: fromEmail,
          })
        }
      }
    }

    return NextResponse.json({ received: true, contactMatched: Boolean(contact) })
  } catch (error) {
    console.error('SendGrid inbound webhook failed:', error)
    return NextResponse.json({ error: 'Inbound email processing failed' }, { status: 500 })
  }
}
