import Stripe from 'stripe'

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is required for Stripe actions.')
  }
  return new Stripe(secretKey, { apiVersion: '2024-04-10' })
}

export async function createAppraisalPaymentIntent(
  amount: number, // in cents (55000 = $550)
  dealId: string,
  contactEmail: string,
  contactName: string
) {
  return getStripeClient().paymentIntents.create({
    amount,
    currency: 'usd',
    metadata: { deal_id: dealId, contact_email: contactEmail, type: 'appraisal' },
    receipt_email: contactEmail,
    description: `Appraisal Fee — Asset Lift Lending (${contactName})`,
  })
}

export async function createPortalSession(customerId: string) {
  return getStripeClient().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/portal`,
  })
}
