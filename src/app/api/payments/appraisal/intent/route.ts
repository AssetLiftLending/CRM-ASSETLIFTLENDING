import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const STAFF_ROLES = ['platform_admin', 'organization_admin', 'owner', 'loan_officer', 'processor']

/**
 * Opens a card charge for the appraisal fee, taken over the phone.
 *
 * Card details never reach this server: the browser sends them straight to
 * Stripe from its hosted fields and confirms against the secret returned here.
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

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe is not configured. Add STRIPE_SECRET_KEY.' }, { status: 503 })
  }

  let dealId = ''
  let amount = 0
  try {
    const body = await req.json()
    dealId = String(body?.dealId ?? '')
    amount = Number(body?.amount ?? 0)
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!dealId) return NextResponse.json({ error: 'Which deal is this for?' }, { status: 400 })
  if (!Number.isFinite(amount) || amount < 1 || amount > 10000) {
    return NextResponse.json({ error: 'Enter an amount between $1 and $10,000.' }, { status: 400 })
  }

  const { data: deal } = await admin
    .from('deals')
    .select('id, contact_id, contacts(first_name, last_name, email)')
    .eq('id', dealId)
    .single()

  if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

  const contact = (Array.isArray(deal.contacts) ? deal.contacts[0] : deal.contacts) as
    { first_name?: string; last_name?: string; email?: string } | null
  const contactName = [contact?.first_name, contact?.last_name].filter(Boolean).join(' ') || 'Borrower'

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' })
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      payment_method_types: ['card'],
      description: `Appraisal Fee — Asset Lift Lending (${contactName})`,
      receipt_email: contact?.email ?? undefined,
      metadata: {
        deal_id: dealId,
        contact_id: deal.contact_id ?? '',
        type: 'appraisal',
        taken_by: profile.id,
      },
    })

    await admin.from('deals').update({ stripe_payment_intent: intent.id }).eq('id', dealId)

    return NextResponse.json({ clientSecret: intent.client_secret, paymentIntentId: intent.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stripe rejected the charge'
    console.error('POST /api/payments/appraisal/intent', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
