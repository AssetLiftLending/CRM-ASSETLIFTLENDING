import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2024-04-10' })

export async function POST(req: NextRequest) {
  try {
    const { deal_id, contact_id, amount } = await req.json()
    const supabase = createAdminClient()

    // Get contact for prefill
    const { data: contact } = await supabase
      .from('contacts')
      .select('first_name, last_name, email')
      .eq('id', contact_id)
      .single()

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: 'Property Appraisal Fee', description: 'Required appraisal for loan processing' },
          unit_amount: amount * 100,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/deals/${deal_id}?appraisal_paid=1`,
      cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL}/deals/${deal_id}`,
      customer_email: contact?.email ?? undefined,
      metadata: { deal_id, contact_id },
    })

    // Update deal with payment intent
    await supabase.from('deals').update({ stripe_payment_intent: session.id }).eq('id', deal_id)

    return NextResponse.json({ url: session.url, payment_link: session.url })
  } catch (err) {
    console.error('Payment error:', err)
    return NextResponse.json({ error: 'Payment setup failed' }, { status: 500 })
  }
}
