import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-04-10',
})

export async function createAppraisalPaymentIntent(
  amount: number, // in cents (55000 = $550)
  dealId: string,
  contactEmail: string,
  contactName: string
) {
  return stripe.paymentIntents.create({
    amount,
    currency: 'usd',
    metadata: { deal_id: dealId, contact_email: contactEmail, type: 'appraisal' },
    receipt_email: contactEmail,
    description: `Appraisal Fee — Asset Lift Lending (${contactName})`,
  })
}

export async function createPortalSession(customerId: string) {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/portal`,
  })
}
