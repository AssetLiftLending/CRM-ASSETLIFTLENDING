'use client'
import { useState } from 'react'

export default function BrokerSignupPage() {
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    company_name: '', license_number: '', state: '',
    password: '', confirm_password: '',
    how_many_deals: '', notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  function set(field: string, val: string) {
    setForm(f => ({ ...f, [field]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/broker/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Signup failed')
      setSubmitted(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 bg-[#D4A017]/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#D4A017]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-white font-bold text-2xl mb-3">Application Submitted!</h2>
          <p className="text-gray-400 mb-6">
            Thank you for applying to become an Asset Lift Lending broker partner.
            We'll review your application and email you within 1 business day with your account access.
          </p>
          <a href="/broker/login" className="inline-block bg-[#D4A017] text-black font-bold px-6 py-3 rounded-lg hover:bg-[#E5B828]">
            Return to Login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-[#D4A017] rounded-full flex items-center justify-center text-black font-black text-lg">A</div>
            <span className="text-white font-bold text-2xl">Asset Lift Lending</span>
          </div>
          <p className="text-gray-400 text-sm">Broker Partner Application</p>
        </div>

        <div className="bg-[#111] rounded-2xl border border-gray-800 p-8">
          <h2 className="text-white font-semibold text-lg mb-6">Apply for Broker Access</h2>

          {error && (
            <div className="mb-5 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-400 text-xs mb-1.5">First Name *</label>
                <input required value={form.first_name} onChange={e => set('first_name', e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4A017]"
                  placeholder="Jane" />
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1.5">Last Name *</label>
                <input required value={form.last_name} onChange={e => set('last_name', e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4A017]"
                  placeholder="Doe" />
              </div>
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1.5">Business Email *</label>
              <input required type="email" value={form.email} onChange={e => set('email', e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4A017]"
                placeholder="jane@brokeragefirm.com" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-400 text-xs mb-1.5">Phone *</label>
                <input required type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4A017]"
                  placeholder="+1 (555) 000-0000" />
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1.5">State *</label>
                <input required value={form.state} onChange={e => set('state', e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4A017]"
                  placeholder="NY" maxLength={2} />
              </div>
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1.5">Company / Brokerage Name *</label>
              <input required value={form.company_name} onChange={e => set('company_name', e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4A017]"
                placeholder="ABC Mortgage Brokerage" />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1.5">NMLS / License Number</label>
              <input value={form.license_number} onChange={e => set('license_number', e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4A017]"
                placeholder="NMLS #123456" />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1.5">Estimated deals per month</label>
              <select value={form.how_many_deals} onChange={e => set('how_many_deals', e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4A017]">
                <option value="">Select range</option>
                <option value="1-2">1–2 deals/month</option>
                <option value="3-5">3–5 deals/month</option>
                <option value="6-10">6–10 deals/month</option>
                <option value="10+">10+ deals/month</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1.5">Password *</label>
              <input required type="password" value={form.password} onChange={e => set('password', e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4A017]"
                placeholder="Min. 8 characters" minLength={8} />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1.5">Confirm Password *</label>
              <input required type="password" value={form.confirm_password} onChange={e => set('confirm_password', e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4A017]"
                placeholder="Re-enter password" minLength={8} />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1.5">Anything else you'd like us to know?</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4A017] resize-none"
                placeholder="Types of deals you send, states you work in, etc." />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-[#D4A017] text-black font-bold py-3 rounded-lg hover:bg-[#E5B828] transition-colors disabled:opacity-50 mt-2">
              {loading ? 'Submitting…' : 'Submit Broker Application'}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-6">
            Already approved?{' '}
            <a href="/broker/login" className="text-[#D4A017] hover:underline">Sign In</a>
          </p>
        </div>
      </div>
    </div>
  )
}
