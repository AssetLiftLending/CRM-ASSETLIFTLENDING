import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const SIGNATURE_HEADER = 'x-twilio-email-event-webhook-signature'
const TIMESTAMP_HEADER = 'x-twilio-email-event-webhook-timestamp'

interface SendGridEvent {
  event?: string
  email?: string
  timestamp?: number
  sg_message_id?: string
  communication_id?: string
  reason?: string
  url?: string
  type?: string
}

/**
 * Status precedence — a late "delivered" callback must never overwrite an "opened".
 * Failures rank highest so a bounce is always the visible outcome.
 */
const STATUS_RANK: Record<string, number> = {
  queued: 1, processed: 1, sent: 2, delivered: 3, opened: 4, clicked: 5,
  deferred: 2, bounced: 6, dropped: 6, blocked: 6, spam: 6, unsubscribed: 6, failed: 6,
}

const EVENT_STATUS: Record<string, string> = {
  processed:    'sent',
  deferred:     'deferred',
  delivered:    'delivered',
  open:         'opened',
  click:        'clicked',
  bounce:       'bounced',
  dropped:      'dropped',
  blocked:      'blocked',
  spamreport:   'spam',
  unsubscribe:  'unsubscribed',
  group_unsubscribe: 'unsubscribed',
}

/** Verifies SendGrid's signed event webhook (ECDSA P-256 over timestamp + raw body). */
function verifySignature(rawBody: string, signature: string | null, timestamp: string | null) {
  const publicKey = process.env.SENDGRID_WEBHOOK_PUBLIC_KEY?.trim()
  if (!publicKey) return { ok: false, reason: 'unconfigured' as const }
  if (!signature || !timestamp) return { ok: false, reason: 'missing-headers' as const }

  try {
    const key = crypto.createPublicKey({
      key: Buffer.from(publicKey, 'base64'),
      format: 'der',
      type: 'spki',
    })
    const verified = crypto
      .createVerify('sha256')
      .update(Buffer.from(timestamp + rawBody))
      .verify(key, Buffer.from(signature, 'base64'))
    return { ok: verified, reason: verified ? ('ok' as const) : ('bad-signature' as const) }
  } catch (err) {
    console.error('SendGrid event webhook — signature check failed', err)
    return { ok: false, reason: 'bad-signature' as const }
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const check = verifySignature(rawBody, req.headers.get(SIGNATURE_HEADER), req.headers.get(TIMESTAMP_HEADER))

  if (!check.ok) {
    if (check.reason === 'unconfigured') {
      // Signature verification is not optional — refuse rather than trust unsigned traffic.
      console.error('SendGrid event webhook rejected: SENDGRID_WEBHOOK_PUBLIC_KEY is not set')
      return NextResponse.json({ error: 'Event webhook is not configured' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
  }

  let events: SendGridEvent[]
  try {
    const parsed = JSON.parse(rawBody)
    events = Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const supabase = createAdminClient()
  let updated = 0

  for (const event of events) {
    const status = EVENT_STATUS[event.event ?? '']
    if (!status) continue

    // Prefer the custom arg we attach at send time; fall back to the message id prefix.
    let query = supabase.from('communications').select('id, status, opened_at, clicked_at').limit(1)
    if (event.communication_id) {
      query = query.eq('id', event.communication_id)
    } else if (event.sg_message_id) {
      query = query.eq('sendgrid_id', event.sg_message_id.split('.')[0])
    } else {
      continue
    }

    const { data: rows } = await query
    const comm = rows?.[0]
    if (!comm) continue

    const currentRank = STATUS_RANK[comm.status ?? ''] ?? 0
    const patch: Record<string, unknown> = {}

    if ((STATUS_RANK[status] ?? 0) >= currentRank) patch.status = status
    if (status === 'opened' && !comm.opened_at) {
      patch.opened_at = new Date((event.timestamp ?? Date.now() / 1000) * 1000).toISOString()
    }
    if (status === 'clicked') {
      if (!comm.clicked_at) patch.clicked_at = new Date((event.timestamp ?? Date.now() / 1000) * 1000).toISOString()
      if (!comm.opened_at) patch.opened_at = new Date((event.timestamp ?? Date.now() / 1000) * 1000).toISOString()
    }
    if (event.reason) patch.ai_summary = `${status}: ${event.reason}`.slice(0, 500)

    if (Object.keys(patch).length) {
      await supabase.from('communications').update(patch).eq('id', comm.id)
      updated++
    }
  }

  return NextResponse.json({ ok: true, received: events.length, updated })
}
