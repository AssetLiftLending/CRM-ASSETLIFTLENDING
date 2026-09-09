'use client'

import { useMemo, useState } from 'react'
import {
  CardCvcElement,
  CardExpiryElement,
  CardNumberElement,
  Elements,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { CreditCard, Lock } from 'lucide-react'
import toast from 'react-hot-toast'

/**
 * Keyed card entry for the appraisal fee, for taking payment over the phone.
 *
 * The number, expiry and CVC are Stripe-hosted fields: what the borrower reads
 * out goes from this browser straight to Stripe. It never passes through the
 * CRM's servers and is never stored, which is what keeps card handling off this
 * business's plate. Everything else on the form is ordinary billing detail.
 */

const FIELD_STYLE = {
  style: {
    base: {
      fontSize: '14px',
      color: '#1A1A1A',
      fontFamily: 'Inter, system-ui, sans-serif',
      '::placeholder': { color: '#9A9A9A' },
    },
    invalid: { color: '#DC2626' },
  },
}

const fieldClass =
  'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gold-500'

interface Props {
  dealId: string
  defaultAmount: number
  billingDefaults?: { name?: string; line1?: string; city?: string; state?: string; postal_code?: string }
  onPaid: () => void
}

export default function AppraisalCardForm(props: Props) {
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  // loadStripe hits the network, so keep one promise for the life of the panel.
  const stripePromise = useMemo(
    () => (publishableKey ? loadStripe(publishableKey) : null),
    [publishableKey]
  )

  if (!stripePromise) {
    return (
      <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-3 text-xs text-yellow-800">
        Card entry needs <code className="font-mono">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> in your
        environment variables. The payment link below works without it.
      </div>
    )
  }

  return (
    <Elements stripe={stripePromise}>
      <CardFields {...props} />
    </Elements>
  )
}

function CardFields({ dealId, defaultAmount, billingDefaults, onPaid }: Props) {
  const stripe = useStripe()
  const elements = useElements()

  const [amount, setAmount] = useState(defaultAmount)
  const [billing, setBilling] = useState({
    name: billingDefaults?.name ?? '',
    line1: billingDefaults?.line1 ?? '',
    city: billingDefaults?.city ?? '',
    state: billingDefaults?.state ?? '',
    postal_code: billingDefaults?.postal_code ?? '',
  })
  const [charging, setCharging] = useState(false)

  const set = (key: keyof typeof billing) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setBilling(prev => ({ ...prev, [key]: e.target.value }))

  async function charge() {
    const cardNumber = elements?.getElement(CardNumberElement)
    if (!stripe || !elements || !cardNumber) return
    if (!billing.name.trim()) return toast.error("Enter the cardholder's name")
    if (!billing.postal_code.trim()) return toast.error('Enter the billing ZIP code')

    setCharging(true)
    try {
      const res = await fetch('/api/payments/appraisal/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, amount }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Could not start the charge')

      const { error, paymentIntent } = await stripe.confirmCardPayment(json.clientSecret, {
        payment_method: {
          card: cardNumber,
          billing_details: {
            name: billing.name.trim(),
            address: {
              line1: billing.line1.trim() || undefined,
              city: billing.city.trim() || undefined,
              state: billing.state.trim() || undefined,
              postal_code: billing.postal_code.trim(),
              country: 'US',
            },
          },
        },
      })

      // Stripe reports a declined card here, with the issuer's own wording.
      if (error) throw new Error(error.message ?? 'The card was declined')
      if (paymentIntent?.status !== 'succeeded') {
        throw new Error(`Payment is ${paymentIntent?.status?.replace(/_/g, ' ') ?? 'incomplete'}`)
      }

      const confirmRes = await fetch('/api/payments/appraisal/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIntentId: paymentIntent.id }),
      })
      if (!confirmRes.ok) {
        const confirmJson = await confirmRes.json().catch(() => ({}))
        // The money is taken; only the record-keeping failed.
        toast.error(confirmJson.error ?? 'Card charged, but the deal did not update. Refresh and check.')
      } else {
        toast.success(`Charged $${amount.toLocaleString()}`)
      }
      onPaid()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The charge did not go through')
    } finally {
      setCharging(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Amount</span>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input type="number" min={1} max={10000} value={amount}
              onChange={e => setAmount(Number(e.target.value))}
              className={`${fieldClass} pl-7`} />
          </div>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Name on card</span>
          <input value={billing.name} onChange={set('name')} placeholder="Jane Investor"
            className={`${fieldClass} mt-1`} />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Card number</span>
          <div className={`${fieldClass} mt-1`}>
            <CardNumberElement options={{ ...FIELD_STYLE, showIcon: true }} />
          </div>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Expiry</span>
          <div className={`${fieldClass} mt-1`}>
            <CardExpiryElement options={FIELD_STYLE} />
          </div>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">CVV</span>
          <div className={`${fieldClass} mt-1`}>
            <CardCvcElement options={FIELD_STYLE} />
          </div>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block lg:col-span-2">
          <span className="text-xs font-medium text-gray-500">Billing address</span>
          <input value={billing.line1} onChange={set('line1')} placeholder="123 Main St"
            className={`${fieldClass} mt-1`} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">City</span>
          <input value={billing.city} onChange={set('city')} placeholder="Monsey"
            className={`${fieldClass} mt-1`} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-500">State</span>
            <input value={billing.state} onChange={set('state')} placeholder="NY" maxLength={2}
              className={`${fieldClass} mt-1 uppercase`} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500">ZIP</span>
            <input value={billing.postal_code} onChange={set('postal_code')} placeholder="10952"
              className={`${fieldClass} mt-1`} />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button type="button" onClick={charge} disabled={charging || !stripe}
          className="flex items-center gap-2 bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-dark-800 font-bold px-5 py-2.5 rounded-xl text-sm">
          <CreditCard size={15} />
          {charging ? 'Charging…' : `Charge $${Number(amount || 0).toLocaleString()}`}
        </button>
        <p className="flex items-center gap-1.5 text-xs text-gray-400">
          <Lock size={11} />
          Card details go straight to Stripe — never stored here.
        </p>
      </div>
    </div>
  )
}
