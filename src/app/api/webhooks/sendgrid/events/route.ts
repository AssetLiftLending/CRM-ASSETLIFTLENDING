import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const statusMap: Record<string, string> = {
  processed: 'processed',
  delivered: 'delivered',
  deferred: 'deferred',
  bounce: 'bounced',
  dropped: 'dropped',
  open: 'opened',
  click: 'clicked',
  spamreport: 'spam_report',
  unsubscribe: 'unsubscribed',
  group_unsubscribe: 'unsubscribed',
}

export async function POST(req: NextRequest) {
  const expectedSecret = process.env.SENDGRID_EVENT_WEBHOOK_SECRET
  if (!expectedSecret || req.nextUrl.searchParams.get('secret') !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const events = await req.json() as Array<Record<string, unknown>>
    const supabase = createAdminClient()

    for (const event of events) {
      const eventName = String(event.event ?? '')
      const messageId = String(event.sg_message_id ?? '').split('.')[0]
      const email = String(event.email ?? '').toLowerCase()
      if (!statusMap[eventName]) continue

      const update: Record<string, string> = { status: statusMap[eventName] }
      const occurredAt = new Date(Number(event.timestamp ?? Date.now() / 1000) * 1000).toISOString()
      if (eventName === 'open') update.opened_at = occurredAt
      if (eventName === 'click') update.clicked_at = occurredAt
      if (messageId) await supabase.from('communications').update(update).eq('sendgrid_id', messageId)

      if (['unsubscribe', 'group_unsubscribe', 'spamreport'].includes(eventName) && email) {
        const { data: contacts } = await supabase.from('contacts').select('id').ilike('email', email)
        const contactIds = contacts?.map((row) => row.id) ?? []
        await supabase.from('contacts').update({ email_opt_out: true }).ilike('email', email)
        if (contactIds.length) {
          await supabase.from('scheduled_automation_actions').update({
            status: 'cancelled',
            processed_at: occurredAt,
            last_error: `Cancelled after SendGrid ${eventName}`,
          }).eq('status', 'pending').eq('cancel_on_reply', true).in('contact_id', contactIds)
        }
      }
    }

    return NextResponse.json({ received: events.length })
  } catch (error) {
    console.error('SendGrid event webhook failed:', error)
    return NextResponse.json({ error: 'Event processing failed' }, { status: 500 })
  }
}
