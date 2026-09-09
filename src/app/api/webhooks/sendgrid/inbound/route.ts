import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { htmlToText } from '@/lib/sendgrid/client'

export const dynamic = 'force-dynamic'

/** Inbound Parse has no signature, so the endpoint is guarded by a shared secret. */
function isAuthorized(req: NextRequest) {
  const expected = process.env.SENDGRID_INBOUND_SECRET?.trim()
  if (!expected) return false

  const supplied =
    req.nextUrl.searchParams.get('secret') ??
    (() => {
      const auth = req.headers.get('authorization') ?? ''
      if (!auth.startsWith('Basic ')) return null
      const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8')
      return decoded.split(':')[1] ?? null
    })()

  if (!supplied) return false
  const a = Buffer.from(supplied)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/** "Jane Doe <jane@example.com>" → jane@example.com */
function extractAddress(value: string) {
  const match = value.match(/<([^>]+)>/)
  return (match ? match[1] : value).trim().toLowerCase()
}

function extractName(value: string) {
  const match = value.match(/^\s*"?([^"<]+?)"?\s*</)
  return match ? match[1].trim() : ''
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    if (!process.env.SENDGRID_INBOUND_SECRET) {
      console.error('SendGrid inbound webhook rejected: SENDGRID_INBOUND_SECRET is not set')
      return NextResponse.json({ error: 'Inbound email is not configured' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const fromRaw = String(form.get('from') ?? '')
  const toRaw   = String(form.get('to') ?? '')
  const subject = String(form.get('subject') ?? '(no subject)')
  const html    = String(form.get('html') ?? '')
  const text    = String(form.get('text') ?? '')

  if (!fromRaw) return NextResponse.json({ error: 'Missing sender' }, { status: 400 })

  const fromEmail = extractAddress(fromRaw)
  const fromName  = extractName(fromRaw)
  const bodyText  = text.trim() || htmlToText(html)

  const supabase = createAdminClient()

  const { data: contact } = await supabase
    .from('contacts')
    .select('id, organization_id')
    .ilike('email', fromEmail)
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from('communications').insert({
    contact_id:      contact?.id ?? null,
    organization_id: contact?.organization_id ?? null,
    type:            'email',
    direction:       'inbound',
    subject,
    body:            html || bodyText,
    snippet:         bodyText.slice(0, 200),
    status:          'received',
    from_email:      fromEmail,
    to_email:        extractAddress(toRaw),
  })

  if (error) {
    console.error('SendGrid inbound webhook — insert failed', error)
    // 200 keeps SendGrid from retrying a payload we cannot store.
    return NextResponse.json({ ok: false, error: error.message })
  }

  return NextResponse.json({ ok: true, matchedContact: contact?.id ?? null, from: fromEmail, fromName })
}
