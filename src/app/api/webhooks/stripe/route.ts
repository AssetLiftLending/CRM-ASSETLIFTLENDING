import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2024-04-10' })

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET ?? '')
  } catch {
    return NextResponse.json({ error: 'Webhook signature invalid' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const dealId  = session.metadata?.deal_id

    if (dealId) {
      const supabase = createAdminClient()
      await supabase.from('deals').update({
        appraisal_paid:    true,
        appraisal_paid_at: new Date().toISOString(),
        appraisal_amount:  (session.amount_total ?? 0) / 100,
      }).eq('id', dealId)
    }
  }

  return NextResponse.json({ received: true })
}
