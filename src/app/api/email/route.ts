import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { canSendCommunications, getStaffContext } from '@/lib/auth/session'
import { buildMergeVars } from '@/lib/communications/merge'
import {
  formatSendGridError,
  getFromAddress,
  htmlToText,
  interpolateEmail,
  isSendGridConfigured,
  isValidEmail,
  parseRecipients,
  sendEmail,
} from '@/lib/sendgrid/client'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const staff = await getStaffContext()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canSendCommunications(staff.role)) {
    return NextResponse.json({ error: 'Your role cannot send email.' }, { status: 403 })
  }
  if (!isSendGridConfigured()) {
    return NextResponse.json(
      { error: 'Email is not configured yet. Add SENDGRID_API_KEY, then check Settings → Email.' },
      { status: 503 }
    )
  }

  const supabase = createAdminClient()

  let payload: {
    contactId?: string
    dealId?: string
    templateId?: string
    to?: string | string[]
    cc?: string | string[]
    bcc?: string | string[]
    subject?: string
    html?: string
    text?: string
    replyTo?: string
  }

  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // ── Resolve contact (for the recipient address and merge tags) ──
  let contact: Record<string, any> | null = null
  if (payload.contactId) {
    const { data } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, email, phone, cell_phone, city, state, entity_name, organization_id')
      .eq('id', payload.contactId)
      .single()
    contact = data ?? null
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  // ── Resolve template ──
  let subject = payload.subject?.trim() ?? ''
  let html = payload.html?.trim() ?? ''
  let text = payload.text?.trim() ?? ''

  if (payload.templateId) {
    const { data: template } = await supabase
      .from('email_templates')
      .select('subject, html_body, text_body')
      .eq('id', payload.templateId)
      .single()
    if (!template) return NextResponse.json({ error: 'Email template not found' }, { status: 404 })
    subject = subject || template.subject
    html = html || template.html_body
    text = text || template.text_body || ''
  }

  const vars = buildMergeVars(contact, staff)
  subject = interpolateEmail(subject, vars)
  html = interpolateEmail(html, vars)
  text = text ? interpolateEmail(text, vars) : ''

  // ── Resolve recipients ──
  let recipients: string[]
  try {
    recipients = parseRecipients(payload.to ?? contact?.email ?? '')
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Invalid recipient' }, { status: 400 })
  }
  if (!recipients.length) {
    return NextResponse.json({ error: 'No recipient — this contact has no email address.' }, { status: 400 })
  }
  if (!subject) return NextResponse.json({ error: 'Subject is required' }, { status: 400 })
  if (!html) return NextResponse.json({ error: 'Message body is required' }, { status: 400 })

  const from = getFromAddress()
  const plain = text || htmlToText(html)

  // Log first so a failed send is still visible in the activity feed.
  const { data: comm, error: logError } = await supabase
    .from('communications')
    .insert({
      contact_id:      contact?.id ?? null,
      deal_id:         payload.dealId ?? null,
      organization_id: contact?.organization_id ?? staff.organizationId ?? null,
      type:            'email',
      direction:       'outbound',
      subject,
      body:            html,
      snippet:         plain.slice(0, 200),
      status:          'queued',
      user_id:         staff.userId,
      from_email:      from.email,
      to_email:        recipients.join(', '),
    })
    .select('id')
    .single()

  if (logError) {
    console.error('POST /api/email — could not log communication', logError)
  }

  try {
    const result = await sendEmail({
      to: recipients,
      subject,
      html,
      text: plain,
      replyTo: payload.replyTo && isValidEmail(payload.replyTo) ? payload.replyTo : staff.email ?? undefined,
      cc: payload.cc,
      bcc: payload.bcc,
      categories: ['crm-outbound'],
      customArgs: comm?.id ? { communication_id: comm.id } : undefined,
    })

    if (comm?.id) {
      await supabase
        .from('communications')
        .update({ status: 'sent', sendgrid_id: result.messageId })
        .eq('id', comm.id)
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      communicationId: comm?.id ?? null,
      to: recipients,
    })
  } catch (err) {
    const message = formatSendGridError(err)
    console.error('POST /api/email', message)

    if (comm?.id) {
      await supabase
        .from('communications')
        .update({ status: 'failed', ai_summary: `Send failed: ${message}` })
        .eq('id', comm.id)
    }

    return NextResponse.json({ error: message }, { status: 502 })
  }
}
