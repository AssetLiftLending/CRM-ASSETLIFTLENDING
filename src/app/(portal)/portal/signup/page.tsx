'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

const LOAN_PROGRAMS = [
  'Fix & Flip',
  'DSCR',
  'Ground-Up Construction',
  'Commercial Bridge',
  'Multifamily',
]

export default function BorrowerSignupPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [account, setAccount] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
  })

  const [deal, setDeal] = useState({
    loan_program: '',
    property_address: '',
    purchase_price: '',
    rehab_amount: '',
    arv: '',
    experience: '',
    notes: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (step === 1) {
      if (account.password !== account.confirm_password) {
        setError('Passwords do not match')
        return
      }
      setError('')
      setStep(2)
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/portal/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account, deal }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Signup failed')
      router.push('/portal?welcome=1')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-[#D4A017] rounded-full flex items-center justify-center text-black font-black text-lg">A</div>
            <span className="text-white font-bold text-2xl">Asset Lift Lending</span>
          </div>
          <p className="text-gray-400 text-sm">Borrower Portal — Create Your Account</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-[#D4A017]' : 'text-gray-600'}`}>
            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold
              ${step >= 1 ? 'border-[#D4A017] bg-[#D4A017] text-black' : 'border-gray-600 text-gray-600'}`}>1</div>
            <span className="text-sm font-medium">Account</span>
          </div>
          <div className={`flex-1 max-w-16 h-0.5 ${step >= 2 ? 'bg-[#D4A017]' : 'bg-gray-700'}`} />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-[#D4A017]' : 'text-gray-600'}`}>
            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold
              ${step >= 2 ? 'border-[#D4A017] bg-[#D4A017] text-black' : 'border-gray-600 text-gray-600'}`}>2</div>
            <span className="text-sm font-medium">Loan Details</span>
          </div>
        </div>

        <div className="bg-[#111] rounded-2xl border border-gray-800 p-8">
          {error && (
            <div className="mb-5 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {step === 1 && (
              <>
                <h2 className="text-white font-semibold text-lg mb-5">Create Your Account</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-xs mb-1.5">First Name *</label>
                    <input required value={account.first_name}
                      onChange={e => setAccount(a => ({ ...a, first_name: e.target.value }))}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4A017]"
                      placeholder="John" />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1.5">Last Name *</label>
                    <input required value={account.last_name}
                      onChange={e => setAccount(a => ({ ...a, last_name: e.target.value }))}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4A017]"
                      placeholder="Smith" />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1.5">Email Address *</label>
                  <input required type="email" value={account.email}
                    onChange={e => setAccount(a => ({ ...a, email: e.target.value }))}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4A017]"
                    placeholder="john@example.com" />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1.5">Phone Number</label>
                  <input type="tel" value={account.phone}
                    onChange={e => setAccount(a => ({ ...a, phone: e.target.value }))}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4A017]"
                    placeholder="+1 (555) 000-0000" />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1.5">Password *</label>
                  <input required type="password" value={account.password}
                    onChange={e => setAccount(a => ({ ...a, password: e.target.value }))}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4A017]"
                    placeholder="Min. 8 characters" minLength={8} />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1.5">Confirm Password *</label>
                  <input required type="password" value={account.confirm_password}
                    onChange={e => setAccount(a => ({ ...a, confirm_password: e.target.value }))}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4A017]"
                    placeholder="Re-enter password" minLength={8} />
                </div>
                <button type="submit"
                  className="w-full bg-[#D4A017] text-black font-bold py-3 rounded-lg hover:bg-[#E5B828] transition-colors mt-2">
                  Continue to Loan Details →
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="text-white font-semibold text-lg mb-5">Tell Us About Your Deal</h2>
                <div>
                  <label className="block text-gray-400 text-xs mb-2">Loan Program *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {LOAN_PROGRAMS.map(p => (
                      <button key={p} type="button"
                        onClick={() => setDeal(d => ({ ...d, loan_program: p }))}
                        className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors text-left
                          ${deal.loan_program === p
                            ? 'border-[#D4A017] bg-[#D4A017]/10 text-[#D4A017]'
                            : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1.5">Property Address *</label>
                  <input required value={deal.property_address}
                    onChange={e => setDeal(d => ({ ...d, property_address: e.target.value }))}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4A017]"
                    placeholder="123 Main St, City, State 12345" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-xs mb-1.5">Purchase Price *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-gray-500 text-sm">$</span>
                      <input required type="number" value={deal.purchase_price}
                        onChange={e => setDeal(d => ({ ...d, purchase_price: e.target.value }))}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-7 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4A017]"
                        placeholder="350,000" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1.5">Rehab Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-gray-500 text-sm">$</span>
                      <input type="number" value={deal.rehab_amount}
                        onChange={e => setDeal(d => ({ ...d, rehab_amount: e.target.value }))}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-7 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4A017]"
                        placeholder="50,000" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1.5">After Repair Value (ARV)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-500 text-sm">$</span>
                    <input type="number" value={deal.arv}
                      onChange={e => setDeal(d => ({ ...d, arv: e.target.value }))}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-7 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4A017]"
                      placeholder="475,000" />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1.5">Real Estate Experience</label>
                  <select value={deal.experience}
                    onChange={e => setDeal(d => ({ ...d, experience: e.target.value }))}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4A017]">
                    <option value="">Select experience level</option>
                    <option value="0">First-time investor</option>
                    <option value="1-3">1–3 deals</option>
                    <option value="4-10">4–10 deals</option>
                    <option value="10+">10+ deals</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1.5">Additional Notes</label>
                  <textarea value={deal.notes}
                    onChange={e => setDeal(d => ({ ...d, notes: e.target.value }))}
                    rows={3}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4A017] resize-none"
                    placeholder="Anything else we should know about this deal..." />
                </div>
                <div className="flex gap-3 mt-2">
                  <button type="button" onClick={() => setStep(1)}
                    className="flex-1 bg-gray-800 text-white font-semibold py-3 rounded-lg hover:bg-gray-700 transition-colors">
                    ← Back
                  </button>
                  <button type="submit" disabled={loading || !deal.loan_program || !deal.property_address || !deal.purchase_price}
                    className="flex-1 bg-[#D4A017] text-black font-bold py-3 rounded-lg hover:bg-[#E5B828] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    {loading ? 'Submitting…' : 'Submit Application'}
                  </button>
                </div>
              </>
            )}
          </form>

          <p className="text-center text-gray-500 text-sm mt-6">
            Already have an account?{' '}
            <a href="/portal/login" className="text-[#D4A017] hover:underline">Sign In</a>
          </p>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          © 2024 Asset Lift Lending · <a href="https://assetliftlending.com" className="hover:text-gray-400">assetliftlending.com</a>
        </p>
      </div>
    </div>
  )
}
