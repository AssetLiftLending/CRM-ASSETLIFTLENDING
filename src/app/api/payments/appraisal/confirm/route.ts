import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const STAFF_ROLES = ['platform_admin', 'organization_admin', 'owner', 'loan_officer', 'processor']

/**
 * Marks the appraisal paid once a keyed-in card has gone through.
 *
 * The payment is re-read from Stripe rather than trusted from the browser, and
 * this runs whether or not the Stripe webhook is configured.
 */
export async function POST(req: NextRequest) {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('id, role').eq('id', user.id).single()
  if (!profile || !STAFF_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'Your role cannot take payments.' }, { status: 403 })
  }

  let paymentIntentId = ''
  try {
    const body = await req.json()
    paymentIntentId = String(body?.paymentIntentId ?? '')
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (!paymentIntentId) return NextResponse.json({ error: 'Missing payment reference' }, { status: 400 })

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2024-04-10' })
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId)

    if (intent.status !== 'succeeded') {
      return NextResponse.json({ error: `Payment is ${intent.status.replace(/_/g, ' ')}.` }, { status: 409 })
    }

    const dealId = intent.metadata?.deal_id
    if (!dealId) return NextResponse.json({ error: 'That payment is not linked to a deal.' }, { status: 400 })

    await admin.from('deals').update({
      appraisal_paid:    true,
      appraisal_paid_at: new Date().toISOString(),
      appraisal_amount:  intent.amount_received / 100,
    }).eq('id', dealId)

    return NextResponse.json({ ok: true, amount: intent.amount_received / 100 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not confirm the payment'
    console.error('POST /api/payments/appraisal/confirm', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
